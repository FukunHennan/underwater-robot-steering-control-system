/**
 ****************************************************************************************************
 * @file        atk_ms901m_uart.h
 * @author      chenfukun
 * @version     V1.0
 * @date        2026-04-14
 * @brief       水下智能转向系统 - ATK-MS901M 模块 UART 接口驱动头文件
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 ****************************************************************************************************
 */

#ifndef __ATK_MS901M_UART_H
#define __ATK_MS901M_UART_H

#include "sys.h"

/* 引脚定义 */
#define ATK_MS901M_UART_TX_GPIO_PORT            GPIOB
#define ATK_MS901M_UART_TX_GPIO_PIN             GPIO_PIN_10
#define ATK_MS901M_UART_TX_GPIO_AF              GPIO_AF7_USART3
#define ATK_MS901M_UART_TX_GPIO_CLK_ENABLE()    do{ __HAL_RCC_GPIOB_CLK_ENABLE(); }while(0)

#define ATK_MS901M_UART_RX_GPIO_PORT            GPIOB
#define ATK_MS901M_UART_RX_GPIO_PIN             GPIO_PIN_11
#define ATK_MS901M_UART_RX_GPIO_AF              GPIO_AF7_USART3
#define ATK_MS901M_UART_RX_GPIO_CLK_ENABLE()    do{ __HAL_RCC_GPIOB_CLK_ENABLE(); }while(0)

#define ATK_MS901M_UART_INTERFACE               USART3
#define ATK_MS901M_UART_IRQn                    USART3_IRQn
#define ATK_MS901M_UART_IRQHandler              USART3_IRQHandler
#define ATK_MS901M_UART_CLK_ENABLE()            do{ __HAL_RCC_USART3_CLK_ENABLE(); }while(0)

/* UART 接收 FIFO 缓冲区大小 */
#define ATK_MS901M_UART_RX_FIFO_BUF_SIZE        128

/* 函数声明 */
uint8_t atk_ms901m_uart_rx_fifo_write(uint8_t *dat, uint16_t len);
uint16_t atk_ms901m_uart_rx_fifo_read(uint8_t *dat, uint16_t len);
void atk_ms901m_rx_fifo_flush(void);
void atk_ms901m_uart_send(uint8_t *dat, uint8_t len);
void atk_ms901m_uart_init(uint32_t baudrate);

#endif
