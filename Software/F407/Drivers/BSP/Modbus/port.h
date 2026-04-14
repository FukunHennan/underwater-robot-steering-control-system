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
 * File: $Id: port.h,v 1.9 2006/12/07 22:10:34 wolti Exp $
 */

#ifndef _PORT_H
#define _PORT_H

#include <assert.h>
#include "stm32f4xx_hal.h"

/* ----------------------- Type definitions ---------------------------------*/
typedef int             BOOL;
typedef unsigned char   UCHAR;
typedef char            CHAR;
typedef unsigned short  USHORT;
typedef short           SHORT;
typedef unsigned long   ULONG;
typedef long            LONG;
typedef void            *LPVOID;

typedef enum
{
    EV_READY,                   /*!< Startup finished. */
    EV_FRAME_RECEIVED,          /*!< Frame received. */
    EV_EXECUTE,                 /*!< Execute function. */
    EV_FRAME_SENT               /*!< Frame sent. */
} eMBEventType;

typedef enum
{
    MB_PAR_NONE,                /*!< No parity. */
    MB_PAR_ODD,                 /*!< Odd parity. */
    MB_PAR_EVEN                 /*!< Even parity. */
} eMBParity;

/* ----------------------- Defines ------------------------------------------*/
#define true            1
#define false           0
#define TRUE            1
#define FALSE           0

#define INLINE          inline
#define ENTER_CRITICAL_SECTION( )    __disable_irq()
#define EXIT_CRITICAL_SECTION( )     __enable_irq()

/* ----------------------- Platform dependent defines ------------------------*/
#define MB_TIMER_TIMEOUT_MS   100     /*!< Modbus timer timeout in milliseconds. */
#define MB_SERIAL_BAUDRATE   9600    /*!< Modbus serial baudrate. */
#define MB_SERIAL_PARITY      MB_PAR_EVEN /*!< Modbus serial parity. */

/* ----------------------- function prototypes -------------------------------*/
BOOL            xMBPortSerialInit( UCHAR ucPort, ULONG ulBaudRate, UCHAR ucDataBits, eMBParity eParity, UCHAR ucStopBits );
void            vMBPortSerialClose( void );
BOOL            xMBPortSerialPutByte( CHAR cByte );
BOOL            xMBPortSerialGetByte( CHAR * pucByte );

void            vMBPortSerialEnable( BOOL xRxEnable, BOOL xTxEnable );

BOOL            xMBPortEventInit( void );
BOOL            xMBPortEventPost( eMBEventType eEvent );
BOOL            xMBPortEventGet( eMBEventType * eEvent );

BOOL            xMBPortTimersInit( USHORT usTimeOut50us );
void            vMBPortTimersClose( void );
void            vMBPortTimersEnable( void );
void            vMBPortTimersDisable( void );
void            vMBPortTimersDelay( USHORT usTimeOutMS );

BOOL            xMBPortInit( void );
void            vMBPortClose( void );

#endif
