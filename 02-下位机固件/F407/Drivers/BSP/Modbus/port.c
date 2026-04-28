/*
 * FreeModbus Libary: A portable Modbus implementation for Modbus ASCII/RTU.
 * Copyright (c) 2006 Christian Walter <wolti@sil.at>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products
 *    derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * File: $Id: port.c,v 1.10 2006/12/07 22:10:34 wolti Exp $
 */

#include "port.h"
#include "mb.h"
#include "mbport.h"
#include "usart.h"
#include "delay.h"
#include <stdio.h>

/* ----------------------- Static variables ---------------------------------*/
static UART_HandleTypeDef *huart;
static volatile BOOL xRxEnabled;
static volatile BOOL xTxEnabled;
static volatile BOOL xEventInQueue;
static volatile eMBEventType eQueuedEvent;
static volatile CHAR cLastByte;
static volatile USHORT usConsumedRxCount;
static volatile BOOL xTimerEnabled;
static volatile ULONG ulTimerStartTick;
static volatile ULONG ulTimerTimeoutMs;

/* ----------------------- Start implementation -----------------------------*/
BOOL xMBPortInit(void)
{
    return xMBPortSerialInit( 2, MB_SERIAL_BAUDRATE, 8, MB_SERIAL_PARITY, 1 );
}

void vMBPortClose(void)
{
    vMBPortSerialClose();
    vMBPortTimersClose();
}

BOOL xMBPortSerialInit(UCHAR ucPort, ULONG ulBaudRate, UCHAR ucDataBits, eMBParity eParity, UCHAR ucStopBits)
{
    ( void )ucPort;
    ( void )ucDataBits;

    huart = &g_uart2_handle;
    huart->Instance = USART2;
    huart->Init.BaudRate = ulBaudRate;
    if (eParity != MB_PAR_NONE) {
        huart->Init.WordLength = UART_WORDLENGTH_9B;
    } else {
        huart->Init.WordLength = UART_WORDLENGTH_8B;
    }
    huart->Init.StopBits = ( ucStopBits == 2U ) ? UART_STOPBITS_2 : UART_STOPBITS_1;

    switch (eParity) {
        case MB_PAR_NONE:
            huart->Init.Parity = UART_PARITY_NONE;
            break;
        case MB_PAR_ODD:
            huart->Init.Parity = UART_PARITY_ODD;
            break;
        case MB_PAR_EVEN:
            huart->Init.Parity = UART_PARITY_EVEN;
            break;
        default:
            return false;
    }

    huart->Init.Mode = UART_MODE_TX_RX;
    huart->Init.HwFlowCtl = UART_HWCONTROL_NONE;
    huart->Init.OverSampling = UART_OVERSAMPLING_16;

    xRxEnabled = FALSE;
    xTxEnabled = FALSE;
    usConsumedRxCount = 0;
    g_usart2_rx_sta = 0;

    if( HAL_UART_Init( huart ) != HAL_OK )
    {
        return FALSE;
    }

    /* Enable RXNE interrupt directly (bypass HAL Receive_IT to avoid 9-bit write issues) */
    __HAL_UART_ENABLE_IT( huart, UART_IT_RXNE );

    printf("[PORT] UART2 init: Baud=%lu WL=0x%lX Par=0x%lX Stop=0x%lX\r\n",
           huart->Init.BaudRate, huart->Init.WordLength,
           huart->Init.Parity, huart->Init.StopBits);
    printf("[PORT] CR1=0x%08lX CR2=0x%08lX CR3=0x%08lX\r\n",
           huart->Instance->CR1, huart->Instance->CR2, huart->Instance->CR3);
    return TRUE;
}

void vMBPortSerialClose(void)
{
    if( huart != NULL )
    {
        HAL_UART_DeInit( huart );
    }
}

BOOL xMBPortSerialPutByte(CHAR cByte)
{
    printf("[TX]0x%02X ", ( uint8_t )cByte);
    return ( HAL_UART_Transmit( huart, ( uint8_t * )&cByte, 1, HAL_MAX_DELAY ) == HAL_OK ) ? TRUE : FALSE;
}

BOOL xMBPortSerialGetByte(CHAR *pucByte)
{
    *pucByte = cLastByte;
    return TRUE;
}

void vMBPortSerialEnable(BOOL xRxEnable, BOOL xTxEnable)
{
    xRxEnabled = xRxEnable;
    xTxEnabled = xTxEnable;

    if( xTxEnabled == TRUE )
    {
        while( xTxEnabled == TRUE )
        {
            if( pxMBFrameCBTransmitterEmpty != NULL )
            {
                ( void )pxMBFrameCBTransmitterEmpty();
            }
            else
            {
                xTxEnabled = FALSE;
            }
        }
    }
}

BOOL xMBPortEventInit(void)
{
    xEventInQueue = FALSE;
    eQueuedEvent = EV_READY;
    return TRUE;
}

BOOL xMBPortEventPost(eMBEventType eEvent)
{
    eQueuedEvent = eEvent;
    xEventInQueue = TRUE;
    return TRUE;
}

BOOL xMBPortEventGet(eMBEventType *eEvent)
{
    USHORT rxCount = g_usart2_rx_sta;

    /* Log if new data arrived in buffer */
    if( rxCount > usConsumedRxCount )
    {
        printf("[BUF] %d bytes pending (consumed=%d)\r\n",
               rxCount - usConsumedRxCount, usConsumedRxCount);
    }

    while( xRxEnabled == TRUE && usConsumedRxCount < g_usart2_rx_sta )
    {
        cLastByte = ( CHAR )g_usart2_rx_buf[usConsumedRxCount++];
        printf("[RX]0x%02X ", ( uint8_t )cLastByte);
        if( pxMBFrameCBByteReceived != NULL )
        {
            ( void )pxMBFrameCBByteReceived();
        }
    }

    if( usConsumedRxCount >= g_usart2_rx_sta )
    {
        usConsumedRxCount = 0;
        g_usart2_rx_sta = 0;
    }

    if( xTimerEnabled == TRUE )
    {
        ULONG ulElapsed = HAL_GetTick() - ulTimerStartTick;
        if( ulElapsed >= ulTimerTimeoutMs )
        {
            xTimerEnabled = FALSE;
            printf("\r\n[TMR]T35 expired (%lums)\r\n", ulElapsed);
            if( pxMBPortCBTimerExpired != NULL )
            {
                ( void )pxMBPortCBTimerExpired();
            }
        }
    }

    if( xEventInQueue == TRUE )
    {
        *eEvent = eQueuedEvent;
        xEventInQueue = FALSE;
        printf("[EVT] event=%d\r\n", ( int )*eEvent);
        return TRUE;
    }

    return FALSE;
}

BOOL xMBPortTimersInit(USHORT usTimeOut50us)
{
    ulTimerTimeoutMs = ( ( ULONG )usTimeOut50us * 50UL + 999UL ) / 1000UL;
    if( ulTimerTimeoutMs == 0UL )
    {
        ulTimerTimeoutMs = 1UL;
    }
    xTimerEnabled = FALSE;
    printf("[PORT] Timer init: T35=%lu ms (raw=%u x50us)\r\n", ulTimerTimeoutMs, usTimeOut50us);
    return TRUE;
}

void vMBPortTimersClose(void)
{
    xTimerEnabled = FALSE;
}

void vMBPortTimersEnable(void)
{
    ulTimerStartTick = HAL_GetTick();
    xTimerEnabled = TRUE;
}

void vMBPortTimersDisable(void)
{
    xTimerEnabled = FALSE;
}

void vMBPortTimersDelay(USHORT usTimeOutMS)
{
    delay_ms( usTimeOutMS );
}
