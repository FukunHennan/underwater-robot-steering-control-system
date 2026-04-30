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

/* TX frame buffer - bytes accumulated here; DMA-sent as one frame */
#define MB_TX_BUF_SIZE 256
static uint8_t  s_tx_buf[MB_TX_BUF_SIZE];
static uint16_t s_tx_len = 0;

BOOL xMBPortSerialInit(UCHAR ucPort, ULONG ulBaudRate, UCHAR ucDataBits, eMBParity eParity, UCHAR ucStopBits)
{
    ( void )ucPort;
    ( void )ucDataBits;
    ( void )eParity;
    ( void )ucStopBits;

    /* Initialize USART2 hardware: GPIO, DMA streams, NVIC, baud rate.
     * Also starts DMA RX and enables IDLE interrupt.
     * Safe to call multiple times (e.g. after eMBDisable→eMBInit→eMBEnable
     * for deferred Flash saves). */
    usart2_init(ulBaudRate);

    huart             = &g_uart2_handle;
    xRxEnabled        = FALSE;
    xTxEnabled        = FALSE;
    usConsumedRxCount = 0;
    g_usart2_rx_sta   = 0;
    s_tx_len          = 0;
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
    /* Buffer the byte; entire frame is DMA-sent when pump loop ends */
    if (s_tx_len < MB_TX_BUF_SIZE) {
        s_tx_buf[s_tx_len++] = (uint8_t)cByte;
    }
    return TRUE;
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

    if (xTxEnabled == TRUE)
    {
        /* Pump all frame bytes into s_tx_buf via xMBPortSerialPutByte */
        s_tx_len = 0;
        while (xTxEnabled == TRUE)
        {
            if (pxMBFrameCBTransmitterEmpty != NULL)
                (void)pxMBFrameCBTransmitterEmpty();
            else
                xTxEnabled = FALSE;
        }

        /* Send the complete frame in one blocking call.
         * HAL_UART_Transmit waits for TC (shift register empty), so the
         * master sees a clean frame with no TC-flag race condition.
         * At 9600 baud a 12-byte response takes ~12 ms - acceptable. */
        if (s_tx_len > 0)
        {
            HAL_UART_Transmit(huart, s_tx_buf, s_tx_len, 100);
            s_tx_len = 0;
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
    while (xRxEnabled == TRUE && usConsumedRxCount < g_usart2_rx_sta)
    {
        cLastByte = (CHAR)g_usart2_rx_buf[usConsumedRxCount++];
        if (pxMBFrameCBByteReceived != NULL)
            (void)pxMBFrameCBByteReceived();
    }

    if (usConsumedRxCount >= g_usart2_rx_sta)
    {
        usConsumedRxCount = 0;
        g_usart2_rx_sta   = 0;
    }

    if (xTimerEnabled == TRUE)
    {
        ULONG ulElapsed = HAL_GetTick() - ulTimerStartTick;
        if (ulElapsed >= ulTimerTimeoutMs)
        {
            xTimerEnabled = FALSE;
            if (pxMBPortCBTimerExpired != NULL)
                (void)pxMBPortCBTimerExpired();
        }
    }

    if (xEventInQueue == TRUE)
    {
        *eEvent    = eQueuedEvent;
        xEventInQueue = FALSE;
        return TRUE;
    }
    return FALSE;
}

BOOL xMBPortTimersInit(USHORT usTimeOut50us)
{
    ulTimerTimeoutMs = ((ULONG)usTimeOut50us * 50UL + 999UL) / 1000UL;
    if (ulTimerTimeoutMs == 0UL) ulTimerTimeoutMs = 1UL;
    xTimerEnabled = FALSE;
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
