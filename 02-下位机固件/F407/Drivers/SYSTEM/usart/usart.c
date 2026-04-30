

#include "sys.h"
#include "usart.h"
#include "BSP/ATK_MS901M/atk_ms901m.h"

/* If using OS, please include the corresponding header file */
#if SYS_SUPPORT_OS
#include "includes.h"                               /* OS use */
#endif

/******************************************************************************************/
/* The following code is used to support printf, need to select use MicroLIB */

#if 1
#if (__ARMCC_VERSION >= 6010050)                    /* When using AC6 compiler */
__asm(".global __use_no_semihosting\n\t");          /* Disable semihosting mode */
__asm(".global __ARM_use_no_argv \n\t");            /* AC6 requires main function to be in no-argument form to avoid semihosting mode */

#else
/* When using AC5 compiler, need to define __FILE and disable semihosting mode */
#pragma import(__use_no_semihosting)

struct __FILE
{
    int handle;
    /* Whatever you require here. If the only file you are using is */
    /* standard output using printf() for debugging, no file handling */
    /* is required. */
};

#endif

/* To use semihosting mode, you need to redefine _ttywrch, _sys_exit, _sys_command_string functions, compatible with both AC6 and AC5 modes */
int _ttywrch(int ch)
{
    ch = ch;
    return ch;
}

/* Redefine _sys_exit() to avoid using semihosting mode */
void _sys_exit(int x)
{
    x = x;
}

char *_sys_command_string(char *cmd, int len)
{
    return NULL;
}

/* FILE is defined in stdio.h. */
FILE __stdout;

/* Redefine fputc function, printf will call this function to output characters */
int fputc(int ch, FILE *f)
{
    while ((USART_UX->SR & 0X40) == 0);             /* Wait for the last character to be sent */

    USART_UX->DR = (uint8_t)ch;                     /* Write the character ch to be sent into the DR register */
    return ch;
}
#endif
/***********************************************END*******************************************/
    
#if USART_EN_RX                                     /* If enable receive */

/* Receive buffer, size is USART_REC_LEN bytes. */
uint8_t g_usart_rx_buf[USART_REC_LEN];

/* Receive status
 * bit15:      Receive complete flag
 * bit14:      Received 0x0d
 * bit13~0:    Number of valid received bytes
*/
uint16_t g_usart_rx_sta = 0;

uint8_t g_rx_buffer[RXBUFFERSIZE];                  /* Temporary receive buffer used by HAL */

UART_HandleTypeDef g_uart1_handle;                  /* USART1 handle */

/* USART2 variables (Modbus, DMA mode) */
UART_HandleTypeDef g_uart2_handle;                         /* USART2 handle              */
DMA_HandleTypeDef  g_dma_usart2_rx;                        /* DMA1 Stream5 Ch4 RX        */
DMA_HandleTypeDef  g_dma_usart2_tx;                        /* DMA1 Stream6 Ch4 TX        */
uint8_t  g_usart2_dma_rx_buf[USART2_DMA_RX_SIZE];          /* DMA circular receive buffer*/
uint8_t  g_usart2_rx_buf[USART2_REC_LEN];                  /* Modbus frame process buffer */
volatile uint16_t g_usart2_rx_sta = 0;                     /* Frame byte count (IDLE set)*/

/* Forward */
extern volatile uint8_t g_debug_en;

/**
 * @brief       Initialize USART1 for debug
 * @param       baudrate: Baud rate, can be set to any desired value
 * @note        Note: Before initializing the UART, make sure the clock source is correct, otherwise the baud rate error may be large.
 *              The USART clock source has been configured in sys_stm32_clock_init().
 * @retval      None
 */
void usart_init(uint32_t baudrate)
{
    g_uart1_handle.Instance = USART_UX;                         /* USART1 */
    g_uart1_handle.Init.BaudRate = baudrate;                    /* Baud rate */
    g_uart1_handle.Init.WordLength = UART_WORDLENGTH_8B;        /* 8-bit data format */
    g_uart1_handle.Init.StopBits = UART_STOPBITS_1;             /* 1 stop bit */
    g_uart1_handle.Init.Parity = UART_PARITY_NONE;              /* No parity bit */
    g_uart1_handle.Init.HwFlowCtl = UART_HWCONTROL_NONE;        /* No hardware flow control */
    g_uart1_handle.Init.Mode = UART_MODE_TX_RX;                 /* Transmit and receive mode */
    HAL_UART_Init(&g_uart1_handle);                             /* Initialize USART1 using HAL_UART_Init() */
    
    /* Enable UART receive interrupt, set the UART_IT_RXNE flag, and use the receive buffer and receive completion interrupt callback function */
    HAL_UART_Receive_IT(&g_uart1_handle, (uint8_t *)g_rx_buffer, RXBUFFERSIZE);
}

/**
 * @brief       Initialize USART2 for Modbus
 * @param       baudrate: Baudrate
 * @retval      None
 */
void usart2_init(uint32_t baudrate)
{
    g_uart2_handle.Instance          = USART2;
    g_uart2_handle.Init.BaudRate     = baudrate;
    g_uart2_handle.Init.WordLength   = UART_WORDLENGTH_8B;
    g_uart2_handle.Init.StopBits     = UART_STOPBITS_1;
    g_uart2_handle.Init.Parity       = UART_PARITY_NONE;
    g_uart2_handle.Init.Mode         = UART_MODE_TX_RX;
    g_uart2_handle.Init.HwFlowCtl    = UART_HWCONTROL_NONE;
    g_uart2_handle.Init.OverSampling = UART_OVERSAMPLING_16;

    if (HAL_UART_Init(&g_uart2_handle) != HAL_OK) {
        while (1);
    }

    /* Start DMA RX (non-circular; restarted after each IDLE-detected frame) */
    HAL_UART_Receive_DMA(&g_uart2_handle, g_usart2_dma_rx_buf, USART2_DMA_RX_SIZE);

    /* Enable IDLE line interrupt to detect end-of-Modbus-frame */
    __HAL_UART_ENABLE_IT(&g_uart2_handle, UART_IT_IDLE);
}

/**
 * @brief       Send data via USART2
 * @param       data: Data to send
 * @param       len: Data length
 * @retval      None
 */
void usart2_send_data(uint8_t *data, uint16_t len)
{
    HAL_UART_Transmit(&g_uart2_handle, data, len, 1000);
}

/**
 * @brief       UART low-level initialization function
 * @param       huart: UART handle pointer
 * @note        This function is called by HAL_UART_Init()
 *              Mainly used for clock enabling, pin configuration, and interrupt configuration
 * @retval      None
 */
void HAL_UART_MspInit(UART_HandleTypeDef *huart)
{
    GPIO_InitTypeDef gpio_init_struct;

    if (huart->Instance == USART_UX)  /* USART1 - debug */
    {
        USART_UX_CLK_ENABLE();
        USART_TX_GPIO_CLK_ENABLE();
        USART_RX_GPIO_CLK_ENABLE();

        gpio_init_struct.Pin       = USART_TX_GPIO_PIN;
        gpio_init_struct.Mode      = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull      = GPIO_PULLUP;
        gpio_init_struct.Speed     = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate = USART_TX_GPIO_AF;
        HAL_GPIO_Init(USART_TX_GPIO_PORT, &gpio_init_struct);

        gpio_init_struct.Pin       = USART_RX_GPIO_PIN;
        gpio_init_struct.Alternate = USART_RX_GPIO_AF;
        HAL_GPIO_Init(USART_RX_GPIO_PORT, &gpio_init_struct);

#if USART_EN_RX
        HAL_NVIC_SetPriority(USART_UX_IRQn, 3, 3);
        HAL_NVIC_EnableIRQ(USART_UX_IRQn);
#endif
    }
    else if (huart->Instance == ATK_MS901M_UART_INTERFACE)  /* IMU UART */
    {
        ATK_MS901M_UART_TX_GPIO_CLK_ENABLE();
        ATK_MS901M_UART_RX_GPIO_CLK_ENABLE();
        ATK_MS901M_UART_CLK_ENABLE();

        gpio_init_struct.Pin       = ATK_MS901M_UART_TX_GPIO_PIN;
        gpio_init_struct.Mode      = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull      = GPIO_NOPULL;
        gpio_init_struct.Speed     = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate = ATK_MS901M_UART_TX_GPIO_AF;
        HAL_GPIO_Init(ATK_MS901M_UART_TX_GPIO_PORT, &gpio_init_struct);

        gpio_init_struct.Pin       = ATK_MS901M_UART_RX_GPIO_PIN;
        gpio_init_struct.Alternate = ATK_MS901M_UART_RX_GPIO_AF;
        HAL_GPIO_Init(ATK_MS901M_UART_RX_GPIO_PORT, &gpio_init_struct);

        HAL_NVIC_SetPriority(ATK_MS901M_UART_IRQn, 0, 0);
        HAL_NVIC_EnableIRQ(ATK_MS901M_UART_IRQn);
        __HAL_UART_ENABLE_IT(huart, UART_IT_RXNE);
    }
    else if (huart->Instance == USART2)  /* USART2 - Modbus (DMA) */
    {
        __HAL_RCC_USART2_CLK_ENABLE();
        __HAL_RCC_GPIOA_CLK_ENABLE();
        __HAL_RCC_DMA1_CLK_ENABLE();

        /* PA2 = TX, PA3 = RX */
        gpio_init_struct.Pin       = GPIO_PIN_2 | GPIO_PIN_3;
        gpio_init_struct.Mode      = GPIO_MODE_AF_PP;
        gpio_init_struct.Pull      = GPIO_PULLUP;
        gpio_init_struct.Speed     = GPIO_SPEED_FREQ_HIGH;
        gpio_init_struct.Alternate = GPIO_AF7_USART2;
        HAL_GPIO_Init(GPIOA, &gpio_init_struct);

        /* DMA1 Stream5 Channel4 - USART2 RX */
        g_dma_usart2_rx.Instance                 = DMA1_Stream5;
        g_dma_usart2_rx.Init.Channel             = DMA_CHANNEL_4;
        g_dma_usart2_rx.Init.Direction           = DMA_PERIPH_TO_MEMORY;
        g_dma_usart2_rx.Init.PeriphInc           = DMA_PINC_DISABLE;
        g_dma_usart2_rx.Init.MemInc              = DMA_MINC_ENABLE;
        g_dma_usart2_rx.Init.PeriphDataAlignment = DMA_PDATAALIGN_BYTE;
        g_dma_usart2_rx.Init.MemDataAlignment    = DMA_MDATAALIGN_BYTE;
        g_dma_usart2_rx.Init.Mode                = DMA_NORMAL;
        g_dma_usart2_rx.Init.Priority            = DMA_PRIORITY_HIGH;
        g_dma_usart2_rx.Init.FIFOMode            = DMA_FIFOMODE_DISABLE;
        HAL_DMA_Init(&g_dma_usart2_rx);
        __HAL_LINKDMA(huart, hdmarx, g_dma_usart2_rx);

        /* DMA1 Stream6 Channel4 - USART2 TX */
        g_dma_usart2_tx.Instance                 = DMA1_Stream6;
        g_dma_usart2_tx.Init.Channel             = DMA_CHANNEL_4;
        g_dma_usart2_tx.Init.Direction           = DMA_MEMORY_TO_PERIPH;
        g_dma_usart2_tx.Init.PeriphInc           = DMA_PINC_DISABLE;
        g_dma_usart2_tx.Init.MemInc              = DMA_MINC_ENABLE;
        g_dma_usart2_tx.Init.PeriphDataAlignment = DMA_PDATAALIGN_BYTE;
        g_dma_usart2_tx.Init.MemDataAlignment    = DMA_MDATAALIGN_BYTE;
        g_dma_usart2_tx.Init.Mode                = DMA_NORMAL;
        g_dma_usart2_tx.Init.Priority            = DMA_PRIORITY_HIGH;
        g_dma_usart2_tx.Init.FIFOMode            = DMA_FIFOMODE_DISABLE;
        HAL_DMA_Init(&g_dma_usart2_tx);
        __HAL_LINKDMA(huart, hdmatx, g_dma_usart2_tx);

        /* NVIC for DMA streams */
        HAL_NVIC_SetPriority(DMA1_Stream5_IRQn, 3, 1);
        HAL_NVIC_EnableIRQ(DMA1_Stream5_IRQn);
        HAL_NVIC_SetPriority(DMA1_Stream6_IRQn, 3, 2);
        HAL_NVIC_EnableIRQ(DMA1_Stream6_IRQn);

        /* USART2 NVIC for IDLE interrupt */
        HAL_NVIC_SetPriority(USART2_IRQn, 3, 0);
        HAL_NVIC_EnableIRQ(USART2_IRQn);
    }
}

/* ---- Debug command parser ------------------------------------------------ */

/**
 * @brief  Parse one-line commands from USART1.
 *         Supported: "DBG 1" = enable, "DBG 0" = disable debug output.
 *         Call when g_usart_rx_sta bit15 is set (frame complete).
 */
void usart1_process_cmd(void)
{
    uint16_t len = g_usart_rx_sta & 0x3FFF;
    if (len < 5) { g_usart_rx_sta = 0; return; }
    /* Simple prefix match: "DBG 1" or "DBG 0" */
    if (g_usart_rx_buf[0] == 'D' && g_usart_rx_buf[1] == 'B' &&
        g_usart_rx_buf[2] == 'G' && g_usart_rx_buf[3] == ' ')
    {
        g_debug_en = (g_usart_rx_buf[4] == '1') ? 1u : 0u;
        printf("[DBG] %s\r\n", g_debug_en ? "ON" : "OFF");
    }
    g_usart_rx_sta = 0;
}

/**
 * @brief  USART1 RX complete callback.
 */
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance == USART_UX)
    {
        if ((g_usart_rx_sta & 0x8000) == 0)
        {
            if (g_usart_rx_sta & 0x4000)
            {
                if (g_rx_buffer[0] != 0x0a)
                    g_usart_rx_sta = 0;
                else {
                    g_usart_rx_sta |= 0x8000;
                    usart1_process_cmd();
                }
            }
            else
            {
                if (g_rx_buffer[0] == 0x0d)
                    g_usart_rx_sta |= 0x4000;
                else {
                    g_usart_rx_buf[g_usart_rx_sta & 0x3FFF] = g_rx_buffer[0];
                    g_usart_rx_sta++;
                    if (g_usart_rx_sta > (USART_REC_LEN - 1))
                        g_usart_rx_sta = 0;
                }
            }
        }
    }
    /* USART2 DMA RX complete (buffer full) - treat as frame complete */
    if (huart->Instance == USART2)
    {
        memcpy(g_usart2_rx_buf, g_usart2_dma_rx_buf, USART2_DMA_RX_SIZE);
        g_usart2_rx_sta = USART2_DMA_RX_SIZE;
        /* Restart DMA for next frame */
        HAL_UART_Receive_DMA(&g_uart2_handle, g_usart2_dma_rx_buf, USART2_DMA_RX_SIZE);
    }
}

/**
 * @brief       USART1 interrupt handler
 * @param       None
 * @retval      None
 */
void USART_UX_IRQHandler(void)
{ 
    uint32_t timeout = 0;
    uint32_t maxDelay = 0x1FFFF;
    
#if SYS_SUPPORT_OS                              /* If using OS */
    OSIntEnter();    
#endif

    HAL_UART_IRQHandler(&g_uart1_handle);       /* Call HAL interrupt processing function */

    timeout = 0;
    while (HAL_UART_GetState(&g_uart1_handle) != HAL_UART_STATE_READY) /* Wait for ready */
    {
        timeout++;                              /* Timeout counter */
        if(timeout > maxDelay)
        {
            break;
        }
    }
     
    timeout=0;
    
    /* After each reception, re-enable the interrupt so that RxXferCount is 1 */
    while (HAL_UART_Receive_IT(&g_uart1_handle, (uint8_t *)g_rx_buffer, RXBUFFERSIZE) != HAL_OK)
    {
        timeout++;                              /* Timeout counter */
        if (timeout > maxDelay)
        {
            break;
        }
    }

#if SYS_SUPPORT_OS                              /* If using OS */
    OSIntExit();
#endif

}

/**
 * @brief  USART2 IRQ handler - handles IDLE line (frame end) and error flags.
 *         RXNE bytes are captured by DMA; we only need IDLE to trigger processing.
 */
void USART2_IRQHandler(void)
{
    uint32_t sr = USART2->SR;  /* Reading SR is step-1 of flag-clear on F4 */
    volatile uint32_t dr;

    if (sr & USART_SR_IDLE)
    {
        /* IDLE detected: reading DR is step-2, clears IDLE flag.
         * This single DR read also clears any concurrent error flags
         * (ORE/FE/PE/NE) - avoiding the double-DR-read bug. */
        dr = USART2->DR;
        (void)dr;

        /* Bytes captured by DMA = buffer_size - remaining NDTR */
        uint16_t received = (uint16_t)(USART2_DMA_RX_SIZE -
                                       __HAL_DMA_GET_COUNTER(&g_dma_usart2_rx));
        if (received > 0 && received <= USART2_REC_LEN)
        {
            memcpy(g_usart2_rx_buf, g_usart2_dma_rx_buf, received);
            g_usart2_rx_sta = received;
        }

        /* Restart DMA RX for the next frame */
        HAL_UART_DMAStop(&g_uart2_handle);
        HAL_UART_Receive_DMA(&g_uart2_handle, g_usart2_dma_rx_buf, USART2_DMA_RX_SIZE);
        __HAL_UART_ENABLE_IT(&g_uart2_handle, UART_IT_IDLE);
    }
    else if (sr & (USART_SR_ORE | USART_SR_FE | USART_SR_NE | USART_SR_PE))
    {
        /* Error without IDLE (mid-frame noise): read DR once to clear.
         * DMA continues capturing subsequent valid bytes. */
        dr = USART2->DR;
        (void)dr;
    }
}

/* ---- DMA IRQ handlers ---------------------------------------------------- */

void DMA1_Stream5_IRQHandler(void)
{
    HAL_DMA_IRQHandler(&g_dma_usart2_rx);
}

void DMA1_Stream6_IRQHandler(void)
{
    HAL_DMA_IRQHandler(&g_dma_usart2_tx);
}

#endif


 

 




