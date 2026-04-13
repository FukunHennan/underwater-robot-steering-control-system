#include "atk_ms901m_uart.h"

static UART_HandleTypeDef g_uart_handle;            /* ATK-MS901M UART */
static struct
{
    uint8_t buf[ATK_MS901M_UART_RX_FIFO_BUF_SIZE];  /* ���� */
    uint16_t size;                                  /* �����С */
    uint16_t reader;                                /* ��ָ�� */
    uint16_t writer;                                /* дָ�� */
} g_uart_rx_fifo;                                   /* UART����FIFO */

/**
 * @brief       ATK-MS901M UART����FIFOд������
 * @param       dat: ��д������
 *              len: ��д�����ݵĳ���
 * @retval      0: ����ִ�гɹ�
 *              1: FIFOʣ��ռ䲻��
 */
uint8_t atk_ms901m_uart_rx_fifo_write(uint8_t *dat, uint16_t len)
{
    uint16_t i;
    
    /* ������д��FIFO
     * ������FIFOд��ָ��
     */
    for (i=0; i<len; i++)
    {
        g_uart_rx_fifo.buf[g_uart_rx_fifo.writer] = dat[i];
        g_uart_rx_fifo.writer = (g_uart_rx_fifo.writer + 1) % g_uart_rx_fifo.size;
    }
    
    return 0;
}

/**
 * @brief       ATK-MS901M UART����FIFO��ȡ����
 * @param       dat: ��ȡ���ݴ��λ��
 *              len: ����ȡ���ݵĳ���
 * @retval      0: FIFO��������
 *              ����ֵ: ʵ�ʶ�ȡ�����ݳ���
 */
uint16_t atk_ms901m_uart_rx_fifo_read(uint8_t *dat, uint16_t len)
{
    uint16_t fifo_usage;
    uint16_t i;
    
    /* ��ȡFIFO��ʹ�ô�С */
    if (g_uart_rx_fifo.writer >= g_uart_rx_fifo.reader)
    {
        fifo_usage = g_uart_rx_fifo.writer - g_uart_rx_fifo.reader;
    }
    else
    {
        fifo_usage = g_uart_rx_fifo.size - g_uart_rx_fifo.reader + g_uart_rx_fifo.writer;
    }
    
    /* FIFO���������� */
    if (len > fifo_usage)
    {
        len = fifo_usage;
    }
    
    /* ��FIFO��ȡ����
     * ������FIFO��ȡָ��
     */
    for (i=0; i<len; i++)
    {
        dat[i] = g_uart_rx_fifo.buf[g_uart_rx_fifo.reader];
        g_uart_rx_fifo.reader = (g_uart_rx_fifo.reader + 1) % g_uart_rx_fifo.size;
    }
    
    return len;
}

/**
 * @brief       ATK-MS901M UART����FIFO���
 * @param       ��
 * @retval      ��
 */
void atk_ms901m_rx_fifo_flush(void)
{
    g_uart_rx_fifo.writer = g_uart_rx_fifo.reader;
}

/**
 * @brief       ATK-MS901M UART��������
 * @param       dat: �����͵�����
 *              len: ���������ݵĳ���
 * @retval      ��
 */
void atk_ms901m_uart_send(uint8_t *dat, uint8_t len)
{
    HAL_UART_Transmit(&g_uart_handle, dat, len, HAL_MAX_DELAY);
}

/**
 * @brief       ATK-MS901M UART��ʼ��
 * @param       baudrate: UARTͨѶ������
 * @retval      ��
 */
void atk_ms901m_uart_init(uint32_t baudrate)
{
    g_uart_handle.Instance          = ATK_MS901M_UART_INTERFACE;    /* ATK-MS901M UART */
    g_uart_handle.Init.BaudRate     = baudrate;                     /* ������ */
    g_uart_handle.Init.WordLength   = UART_WORDLENGTH_8B;           /* ����λ */
    g_uart_handle.Init.StopBits     = UART_STOPBITS_1;              /* ֹͣλ */
    g_uart_handle.Init.Parity       = UART_PARITY_NONE;             /* У��λ */
    g_uart_handle.Init.Mode         = UART_MODE_TX_RX;              /* �շ�ģʽ */
    g_uart_handle.Init.HwFlowCtl    = UART_HWCONTROL_NONE;          /* ��Ӳ������ */
    g_uart_handle.Init.OverSampling = UART_OVERSAMPLING_16;         /* ������ */
    HAL_UART_Init(&g_uart_handle);                                  /* ʹ��ATK-MS901M UART
                                                                     * HAL_UART_Init()����ú���HAL_UART_MspInit()
                                                                     * �ú����������ļ�usart.c��
                                                                     */
    g_uart_rx_fifo.size = ATK_MS901M_UART_RX_FIFO_BUF_SIZE;         /* UART����FIFO�����С */
    g_uart_rx_fifo.reader = 0;                                      /* UART����FIFO��ָ�� */
    g_uart_rx_fifo.writer = 0;                                      /* UART����FIFOдָ�� */
}

/**
 * @brief       ATK-MS901M UART interrupt handler
 * @param       None
 * @retval      None
 */
void ATK_MS901M_UART_IRQHandler(void)
{
    uint8_t tmp;
    
    if (__HAL_UART_GET_FLAG(&g_uart_handle, UART_FLAG_ORE) != RESET)    /* UART���չ��ش����ж� */
    {
        __HAL_UART_CLEAR_OREFLAG(&g_uart_handle);                       /* ������չ��ش����жϱ�־ */
        (void)g_uart_handle.Instance->SR;                               /* �ȶ�SR�Ĵ������ٶ�DR�Ĵ��� */
        (void)g_uart_handle.Instance->DR;
    }
    
    if (__HAL_UART_GET_FLAG(&g_uart_handle, UART_FLAG_RXNE) != RESET)   /* UART�����ж� */
    {
        HAL_UART_Receive(&g_uart_handle, &tmp, 1, HAL_MAX_DELAY);       /* UART�������� */
        atk_ms901m_uart_rx_fifo_write(&tmp, 1);                         /* ���յ������ݣ�д��UART����FIFO */
    }
}
