/**
 ****************************************************************************************************
 * @file        atk_ms901m_uart.c
 * @author      chenfukun
 * @version     V1.0
 * @date        2026-04-14
 * @brief       水下智能转向系统 - ATK-MS901M 模块 UART 接口驱动代码
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 ****************************************************************************************************
 */

#include "atk_ms901m_uart.h"

static UART_HandleTypeDef g_uart_handle;            /* ATK-MS901M UART句柄 */
static struct
{
    uint8_t buf[ATK_MS901M_UART_RX_FIFO_BUF_SIZE];  /* 缓冲区 */
    uint16_t size;                                  /* 缓冲区大小 */
    uint16_t reader;                                /* 读指针 */
    uint16_t writer;                                /* 写指针 */
} g_uart_rx_fifo;                                   /* UART接收FIFO */

/**
 * @brief       ATK-MS901M UART接收FIFO写操作
 * @param       dat: 待写入的数据
 *              len: 待写入数据的长度
 * @retval      0: 操作执行成功
 *              1: FIFO剩余空间不足
 */
uint8_t atk_ms901m_uart_rx_fifo_write(uint8_t *dat, uint16_t len)
{
    uint16_t i;

    /* 将数据写入FIFO
     * 更新FIFO写指针
     */
    for (i=0; i<len; i++)
    {
        g_uart_rx_fifo.buf[g_uart_rx_fifo.writer] = dat[i];
        g_uart_rx_fifo.writer = (g_uart_rx_fifo.writer + 1) % g_uart_rx_fifo.size;
    }

    return 0;
}

/**
 * @brief       ATK-MS901M UART接收FIFO读操作
 * @param       dat: 读取数据的存放位置
 *              len: 预期读取数据的长度
 * @retval      0: FIFO没有数据
 *              其他: 实际读取到的数据长度
 */
uint16_t atk_ms901m_uart_rx_fifo_read(uint8_t *dat, uint16_t len)
{
    uint16_t fifo_usage;
    uint16_t i;

    /* 获取FIFO的使用大小 */
    if (g_uart_rx_fifo.writer >= g_uart_rx_fifo.reader)
    {
        fifo_usage = g_uart_rx_fifo.writer - g_uart_rx_fifo.reader;
    }
    else
    {
        fifo_usage = g_uart_rx_fifo.size - g_uart_rx_fifo.reader + g_uart_rx_fifo.writer;
    }

    /* FIFO数据不够 */
    if (len > fifo_usage)
    {
        len = fifo_usage;
    }

    /* 从FIFO读取数据
     * 更新FIFO读指针
     */
    for (i=0; i<len; i++)
    {
        dat[i] = g_uart_rx_fifo.buf[g_uart_rx_fifo.reader];
        g_uart_rx_fifo.reader = (g_uart_rx_fifo.reader + 1) % g_uart_rx_fifo.size;
    }

    return len;
}

/**
 * @brief       ATK-MS901M UART接收FIFO清空
 * @param       无
 * @retval      无
 */
void atk_ms901m_rx_fifo_flush(void)
{
    g_uart_rx_fifo.writer = g_uart_rx_fifo.reader;
}

/**
 * @brief       ATK-MS901M UART数据发送
 * @param       dat: 待发送的数据
 *              len: 待发送数据的长度
 * @retval      无
 */
void atk_ms901m_uart_send(uint8_t *dat, uint8_t len)
{
    HAL_UART_Transmit(&g_uart_handle, dat, len, HAL_MAX_DELAY);
}

/**
 * @brief       ATK-MS901M UART初始化
 * @param       baudrate: UART通信波特率
 * @retval      无
 */
void atk_ms901m_uart_init(uint32_t baudrate)
{
    g_uart_handle.Instance          = ATK_MS901M_UART_INTERFACE;    /* ATK-MS901M UART */
    g_uart_handle.Init.BaudRate     = baudrate;                     /* 波特率 */
    g_uart_handle.Init.WordLength   = UART_WORDLENGTH_8B;           /* 数据位 */
    g_uart_handle.Init.StopBits     = UART_STOPBITS_1;              /* 停止位 */
    g_uart_handle.Init.Parity       = UART_PARITY_NONE;             /* 校验位 */
    g_uart_handle.Init.Mode         = UART_MODE_TX_RX;              /* 收发模式 */
    g_uart_handle.Init.HwFlowCtl    = UART_HWCONTROL_NONE;          /* 硬件流控制 */
    g_uart_handle.Init.OverSampling = UART_OVERSAMPLING_16;         /* 过采样 */
    HAL_UART_Init(&g_uart_handle);                                  /* 初始化ATK-MS901M UART
                                                                     * HAL_UART_Init()函数会调用HAL_UART_MspInit()
                                                                     * 初始化函数在文件usart.c中
                                                                     */
    g_uart_rx_fifo.size = ATK_MS901M_UART_RX_FIFO_BUF_SIZE;         /* UART接收FIFO缓冲区大小 */
    g_uart_rx_fifo.reader = 0;                                      /* UART接收FIFO读指针 */
    g_uart_rx_fifo.writer = 0;                                      /* UART接收FIFO写指针 */
}

/**
 * @brief       ATK-MS901M UART中断服务函数
 * @param       无
 * @retval      无
 */
void ATK_MS901M_UART_IRQHandler(void)
{
    uint8_t tmp;

    if (__HAL_UART_GET_FLAG(&g_uart_handle, UART_FLAG_ORE) != RESET)    /* UART溢出错误中断 */
    {
        __HAL_UART_CLEAR_OREFLAG(&g_uart_handle);                       /* 清除溢出错误中断标志位 */
        (void)g_uart_handle.Instance->SR;                               /* 对SR的读操作是为了对DR的写操作 */
        (void)g_uart_handle.Instance->DR;
    }

    if (__HAL_UART_GET_FLAG(&g_uart_handle, UART_FLAG_RXNE) != RESET)   /* UART接收中断 */
    {
        HAL_UART_Receive(&g_uart_handle, &tmp, 1, HAL_MAX_DELAY);       /* UART接收数据 */
        atk_ms901m_uart_rx_fifo_write(&tmp, 1);                         /* 将接收到的数据写入UART接收FIFO */
    }
}
