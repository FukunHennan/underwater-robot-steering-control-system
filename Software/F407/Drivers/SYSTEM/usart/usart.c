

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

UART_HandleTypeDef g_uart1_handle;                  /* UART handle */


/**
 * @brief       Initialize UART
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
    HAL_UART_Init(&g_uart1_handle);                             /* Initialize UART1 using HAL_UART_Init() */
    
    /* Enable UART receive interrupt, set the UART_IT_RXNE flag, and use the receive buffer and receive completion interrupt callback function */
    HAL_UART_Receive_IT(&g_uart1_handle, (uint8_t *)g_rx_buffer, RXBUFFERSIZE);
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
    if(huart->Instance == USART_UX)                               /* If it is USART1, perform USART1 MSP initialization */
    {
        USART_UX_CLK_ENABLE();                                  /* Enable USART1 clock */
        USART_TX_GPIO_CLK_ENABLE();                             /* Enable TX pin clock */
        USART_RX_GPIO_CLK_ENABLE();                             /* Enable RX pin clock */
        
        gpio_init_struct.Pin = USART_TX_GPIO_PIN;               /* TX pin */
        gpio_init_struct.Mode = GPIO_MODE_AF_PP;                /* Alternate function push-pull */
        gpio_init_struct.Pull = GPIO_PULLUP;                    /* Pull-up */
        gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;          /* High speed */
        gpio_init_struct.Alternate = USART_TX_GPIO_AF;          /* Set to USART1 */
        HAL_GPIO_Init(USART_TX_GPIO_PORT, &gpio_init_struct);   /* Initialize TX pin */

        gpio_init_struct.Pin = USART_RX_GPIO_PIN;               /* RX pin */
        gpio_init_struct.Alternate = USART_RX_GPIO_AF;          /* Set to USART1 */
        HAL_GPIO_Init(USART_RX_GPIO_PORT, &gpio_init_struct);   /* Initialize RX pin */

#if USART_EN_RX
        HAL_NVIC_EnableIRQ(USART_UX_IRQn);                      /* Enable USART1 interrupt channel */
        HAL_NVIC_SetPriority(USART_UX_IRQn, 3, 3);              /* Set priority level 3, sub-priority 3 */
#endif
    }
    else if (huart->Instance == ATK_MS901M_UART_INTERFACE)              /* If it is ATK-MS901M UART */
    {
        ATK_MS901M_UART_TX_GPIO_CLK_ENABLE();                           /* Enable UART TX pin clock */
        ATK_MS901M_UART_RX_GPIO_CLK_ENABLE();                           /* Enable UART RX pin clock */
        ATK_MS901M_UART_CLK_ENABLE();                                   /* Enable UART clock */
        
        gpio_init_struct.Pin        = ATK_MS901M_UART_TX_GPIO_PIN;      /* UART TX pin */
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;                  /* Alternate function push-pull */
        gpio_init_struct.Pull       = GPIO_NOPULL;                      /* No pull-up/down */
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;             /* High speed */
        gpio_init_struct.Alternate  = ATK_MS901M_UART_TX_GPIO_AF;       /* Set to USART3 */
        HAL_GPIO_Init(ATK_MS901M_UART_TX_GPIO_PORT, &gpio_init_struct); /* Initialize UART TX pin */
        
        gpio_init_struct.Pin        = ATK_MS901M_UART_RX_GPIO_PIN;      /* UART RX pin */
        gpio_init_struct.Mode       = GPIO_MODE_AF_PP;                  /* Alternate function push-pull */
        gpio_init_struct.Pull       = GPIO_NOPULL;                      /* No pull-up/down */
        gpio_init_struct.Speed      = GPIO_SPEED_FREQ_HIGH;             /* High speed */
        gpio_init_struct.Alternate  = ATK_MS901M_UART_RX_GPIO_AF;       /* Set to USART3 */
        HAL_GPIO_Init(ATK_MS901M_UART_RX_GPIO_PORT, &gpio_init_struct); /* Initialize UART RX pin */
        
        HAL_NVIC_SetPriority(ATK_MS901M_UART_IRQn, 0, 0);               /* Set priority level 0, sub-priority 0 */
        HAL_NVIC_EnableIRQ(ATK_MS901M_UART_IRQn);                       /* Enable UART interrupt channel */
        
        __HAL_UART_ENABLE_IT(huart, UART_IT_RXNE);                      /* Enable UART receive interrupt */
    }
}

/**
 * @brief       Rx receive completion callback function
 * @param       huart: UART handle pointer
 * @retval      None
 */
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
    if(huart->Instance == USART_UX)             /* If it is USART1 */
    {
        if((g_usart_rx_sta & 0x8000) == 0)      /* Receive not complete */
        {
            if(g_usart_rx_sta & 0x4000)         /* Received 0x0d */
            {
                if(g_rx_buffer[0] != 0x0a) 
                {
                    g_usart_rx_sta = 0;         /* Receive error, start over */
                }
                else 
                {
                    g_usart_rx_sta |= 0x8000;   /* Receive complete */
                }
            }
            else                                /* Haven't received 0X0D yet */
            {
                if(g_rx_buffer[0] == 0x0d)
                {
                    g_usart_rx_sta |= 0x4000;
                }
                else
                {
                    g_usart_rx_buf[g_usart_rx_sta & 0X3FFF] = g_rx_buffer[0] ;
                    g_usart_rx_sta++;
                    if(g_usart_rx_sta > (USART_REC_LEN - 1))
                    {
                        g_usart_rx_sta = 0;     /* Receive data overflow, start over */
                    }
                }
            }
        }
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

#endif


 

 




