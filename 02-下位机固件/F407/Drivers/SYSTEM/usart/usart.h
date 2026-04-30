/**
 ****************************************************************************************************
 * @file        usart.h
 * @author      chenfukun
 * @version     V2.0
 * @date        2026-04-14
 * @brief       UART initialization for USART1 (debug) and USART2 (Modbus)
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 * @attention
 *
 * Project Name: Underwater Intelligent Steering System
 * Test Platform: STM32F407
 *
 ****************************************************************************************************
 */

#ifndef _USART_H
#define _USART_H

#include "stdio.h"
#include "sys.h"

/*******************************************************************************************************/
/* USART1 Configuration (Debug) */

#define USART_TX_GPIO_PORT              GPIOA
#define USART_TX_GPIO_PIN               GPIO_PIN_9
#define USART_TX_GPIO_AF                GPIO_AF7_USART1
#define USART_TX_GPIO_CLK_ENABLE()      do{ __HAL_RCC_GPIOA_CLK_ENABLE(); }while(0)

#define USART_RX_GPIO_PORT              GPIOA
#define USART_RX_GPIO_PIN               GPIO_PIN_10
#define USART_RX_GPIO_AF                GPIO_AF7_USART1
#define USART_RX_GPIO_CLK_ENABLE()      do{ __HAL_RCC_GPIOA_CLK_ENABLE(); }while(0)

#define USART_UX                        USART1
#define USART_UX_IRQn                   USART1_IRQn
#define USART_UX_IRQHandler             USART1_IRQHandler
#define USART_UX_CLK_ENABLE()           do{ __HAL_RCC_USART1_CLK_ENABLE(); }while(0)

/*******************************************************************************************************/
/* USART2 Configuration (Modbus) */

#define USART2_TX_GPIO_PORT              GPIOA
#define USART2_TX_GPIO_PIN               GPIO_PIN_2
#define USART2_TX_GPIO_AF                GPIO_AF7_USART2
#define USART2_TX_GPIO_CLK_ENABLE()      do{ __HAL_RCC_GPIOA_CLK_ENABLE(); }while(0)

#define USART2_RX_GPIO_PORT              GPIOA
#define USART2_RX_GPIO_PIN               GPIO_PIN_3
#define USART2_RX_GPIO_AF                GPIO_AF7_USART2
#define USART2_RX_GPIO_CLK_ENABLE()      do{ __HAL_RCC_GPIOA_CLK_ENABLE(); }while(0)

#define USART2_UX                        USART2
#define USART2_UX_IRQn                   USART2_IRQn
#define USART2_UX_IRQHandler             USART2_IRQHandler
#define USART2_UX_CLK_ENABLE()           do{ __HAL_RCC_USART2_CLK_ENABLE(); }while(0)

/*******************************************************************************************************/

#define USART_REC_LEN   200                     /* USART1 receive buffer size: 200 bytes */
#define USART_EN_RX     1                       /* Enable USART1 receive: 1=enable, 0=disable */
#define RXBUFFERSIZE    1                       /* USART1 HAL receive buffer size */

#define USART2_REC_LEN       256   /* USART2 Modbus frame processing buffer (bytes) */
#define USART2_DMA_RX_SIZE   256   /* USART2 DMA circular RX buffer size (bytes)    */

/* Modbus RTU Configuration */
#define MODBUS_BAUDRATE        9600             /* Modbus default baudrate */
#define MODBUS_PARITY          UART_PARITY_EVEN /* Modbus requires even parity */
#define MODBUS_STOP_BITS       UART_STOPBITS_1  /* Modbus requires 1 stop bit */
#define MODBUS_DATA_BITS       UART_WORDLENGTH_8B /* Modbus requires 8 data bits */

/*******************************************************************************************************/

extern UART_HandleTypeDef g_uart1_handle;       /* USART1 handle */
extern uint8_t  g_usart_rx_buf[USART_REC_LEN];  /* USART1 receive buffer */
extern uint16_t g_usart_rx_sta;                 /* USART1 receive status */
extern uint8_t g_rx_buffer[RXBUFFERSIZE];       /* USART1 HAL receive buffer */

/* USART2 variables */
extern UART_HandleTypeDef g_uart2_handle;                    /* USART2 handle           */
extern DMA_HandleTypeDef  g_dma_usart2_rx;                   /* DMA1 Stream5 Ch4 RX     */
extern DMA_HandleTypeDef  g_dma_usart2_tx;                   /* DMA1 Stream6 Ch4 TX     */
extern uint8_t  g_usart2_dma_rx_buf[USART2_DMA_RX_SIZE];     /* DMA RX circular buffer  */
extern uint8_t  g_usart2_rx_buf[USART2_REC_LEN];             /* Modbus frame buffer      */
extern volatile uint16_t  g_usart2_rx_sta;                   /* Received byte count      */

/* Debug output - default OFF; enable via Modbus REG_DBG_EN or USART1 "DBG 1" */
extern volatile uint8_t g_debug_en;
#define DBG(fmt, ...) do { if (g_debug_en) printf(fmt, ##__VA_ARGS__); } while(0)

/* Function declarations */
void usart_init(uint32_t baudrate);             /* Initialize USART1 (debug)             */
void usart2_init(uint32_t baudrate);            /* Initialize USART2 Modbus (DMA mode)   */
void usart1_process_cmd(void);                  /* Parse debug commands from USART1 RX   */
void usart2_send_data(uint8_t *data, uint16_t len);

#endif







