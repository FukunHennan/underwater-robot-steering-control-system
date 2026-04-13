/**
 ****************************************************************************************************
 * @file        delay.c
 * @author      ALIENTEK
 * @version     V1.0
 * @date        2021-10-14
 * @brief       Use SysTick in polling mode to realize delay function (support ucosii)
 *              Provide delay_init initialization function, delay_us and delay_ms delay functions
 * @license     Copyright (c) 2020-2032, ALIENTEK
 ****************************************************************************************************
 * @attention
 *
 * Test platform: ALIENTEK F407 motor control board
 * Website: www.yuanzige.com
 * Forum: http://www.openedv.com/forum.php
 * Company website: www.alientek.com
 * Taobao: zhengdianyuanzi.tmall.com
 *
 * Modification history
 * V1.0 20211014
 * First release
 *
 ****************************************************************************************************
 */

#include "sys.h"
#include "delay.h"


static uint32_t g_fac_us = 0;       /* us delay multiplier */

/* If SYS_SUPPORT_OS is defined, it means to support OS (such as UCOS) */
#if SYS_SUPPORT_OS

/* Include OS header file (needed by ucos) */
#include "includes.h"

/* Define g_fac_ms variable, which represents the OS beat per ms, that is, how many OS beats per ms, (needed when using OS delay) */
static uint16_t g_fac_ms = 0;

/*
 * To support OS delay, delay_us/delay_ms need to provide OS-related macro definitions and functions
 * Three macro definitions are needed:
 *      delay_osrunning    : Used to indicate whether the OS is currently running, to determine whether to enable task scheduling
 *      delay_ostickspersec: Used to indicate the OS set time beat frequency, delay_init uses this to initialize the systick
 *      delay_osintnesting : Used to indicate the OS interrupt nesting level, because the interrupt will be nested, delay_ms uses polling to ensure timing accuracy
 * Three functions are needed:
 *      delay_osschedlock  : Used to lock OS task scheduling, prevent scheduling
 *      delay_osschedunlock: Used to unlock OS task scheduling, restore scheduling
 *      delay_ostimedly    : Use OS delay, which can block tasks
 *
 * This code supports UCOSII and UCOSIII. For other OS, please refer to the adaptation
 */
 
/* Support UCOSII */
#ifdef  OS_CRITICAL_METHOD                      /* If OS_CRITICAL_METHOD is defined, it means to support UCOSII */
#define delay_osrunning     OSRunning           /* Whether the OS is running, 0: not running; 1: running */
#define delay_ostickspersec OS_TICKS_PER_SEC    /* OS time beat frequency, how many beats per second */
#define delay_osintnesting  OSIntNesting        /* Interrupt nesting level, record the interrupt nesting status */
#endif

/* Support UCOSIII */
#ifdef  CPU_CFG_CRITICAL_METHOD                 /* If CPU_CFG_CRITICAL_METHOD is defined, it means to support UCOSIII */
#define delay_osrunning     OSRunning           /* Whether the OS is running, 0: not running; 1: running */
#define delay_ostickspersec OSCfg_TickRate_Hz   /* OS time beat frequency, how many beats per second */
#define delay_osintnesting  OSIntNestingCtr     /* Interrupt nesting level, record the interrupt nesting status */
#endif

/**
 * @brief     When delaying in us, lock task scheduling (prevent task scheduling during us delay)
 * @param     None  
 * @retval    None
 */  
void delay_osschedlock(void)
{
#ifdef CPU_CFG_CRITICAL_METHOD          /* Using UCOSIII */
    OS_ERR err;
    OSSchedLock(&err);                  /* UCOSIII method, lock scheduling, prevent task scheduling during us delay */
#else                                   /* Using UCOSII */
    OSSchedLock();                      /* UCOSII method, lock scheduling, prevent task scheduling during us delay */
#endif
}

/**
 * @brief     When delaying in us, unlock task scheduling
 * @param     None
 * @retval    None
 */  
void delay_osschedunlock(void)
{
#ifdef CPU_CFG_CRITICAL_METHOD          /* Using UCOSIII */
    OS_ERR err;
    OSSchedUnlock(&err);                /* UCOSIII method, unlock scheduling */
#else                                   /* Using UCOSII */
    OSSchedUnlock();                    /* UCOSII method, unlock scheduling */
#endif
}

/**
 * @brief     When delaying in us, unlock task scheduling
 * @param     ticks : Number of ticks to delay
 * @retval    None
 */  
void delay_ostimedly(uint32_t ticks)
{
#ifdef CPU_CFG_CRITICAL_METHOD
    OS_ERR err; 
    OSTimeDly(ticks, OS_OPT_TIME_PERIODIC, &err);   /* UCOSIII delay, periodic mode */
#else
    OSTimeDly(ticks);                               /* UCOSII delay */
#endif 
}

/**
 * @brief     systick interrupt handler, used when using OS
 * @param     ticks : Number of ticks to delay  
 * @retval    None
 */  
void SysTick_Handler(void)
{
    HAL_IncTick();
    if (delay_osrunning == 1)       /* If OS is running, execute the OS's tick processing */
    {
        OSIntEnter();               /* Enter interrupt */
        OSTimeTick();               /* Call ucos time tick processing function */
        OSIntExit();                /* Exit interrupt and schedule if needed */
    }
}
#endif

/**
 * @brief     Initialize delay system
 * @param     sysclk: System clock frequency, equal to CPU frequency (rcc_c_ck), 168MHz
 * @retval    None
 */  
void delay_init(uint16_t sysclk)
{
#if SYS_SUPPORT_OS                                      /* If need to support OS */
    uint32_t reload;
#endif
    HAL_SYSTICK_CLKSourceConfig(SYSTICK_CLKSOURCE_HCLK);/* SYSTICK uses external clock source, frequency is HCLK */

    g_fac_us = sysclk;                                  /* Whether to use OS or not, g_fac_us will be used */
#if SYS_SUPPORT_OS                                      /* If need to support OS. */
    reload = sysclk;                                    /* Number of beats per second, unit is M */
    reload *= 1000000 / delay_ostickspersec;            /* According to delay_ostickspersec set the beat time, reload is 24-bit
                                                         * register, maximum value: 16777216, at 168M, about 0.09986s overflow
                                                         */
    g_fac_ms = 1000 / delay_ostickspersec;              /* Calculate the number of OS beats per ms */ 
    SysTick->CTRL |= SysTick_CTRL_TICKINT_Msk;          /* Enable SYSTICK interrupt */
    SysTick->LOAD = reload;                             /* Interrupt once every 1/delay_ostickspersec seconds */
    SysTick->CTRL |= SysTick_CTRL_ENABLE_Msk;           /* Enable SYSTICK */
#endif 
}

#if SYS_SUPPORT_OS                                      /* If need to support OS, use the following code */

/**
 * @brief     Delay nus
 * @param     nus: Delay time in us
 * @note      nus value range: 0 ~ 190887435us (maximum value: 2^32 / fac_us @fac_us = 21)
 * @retval    None
 */ 
void delay_us(uint32_t nus)
{
    uint32_t ticks;
    uint32_t told, tnow, tcnt = 0;
    uint32_t reload = SysTick->LOAD;        /* LOAD value */
    ticks = nus * g_fac_us;                 /* Required number of ticks */
    delay_osschedlock();                    /* Lock OS scheduling to prevent task scheduling during us delay */
    told = SysTick->VAL;                    /* Get the current value of the counter */
    while (1)
    {
        tnow = SysTick->VAL;
        if (tnow != told)
        {
            if (tnow < told)
            {
                tcnt += told - tnow;        /* Note: SYSTICK is a down counter, so subtract */
            }
            else
            {
                tcnt += reload - tnow + told;
            }
            told = tnow;
            if (tcnt >= ticks) 
            {
                break;                      /* Time up/meet the required delay time, exit the loop */
            }
        }
    }
    delay_osschedunlock();                  /* Unlock OS scheduling */
} 

/**
 * @brief     Delay nms
 * @param     nms: Delay time in ms (0< nms <= 65535) 
 * @retval    None
 */
void delay_ms(uint16_t nms)
{
    if (delay_osrunning && delay_osintnesting == 0)     /* If the OS is running and not in an interrupt (interrupt nesting will affect timing) */
    {
        if (nms >= g_fac_ms)                            /* If the delay time is greater than or equal to the OS beat time, use OS delay */
        { 
            delay_ostimedly(nms / g_fac_ms);            /* OS delay */
        }
        nms %= g_fac_ms;                                /* OS cannot provide such a small delay, use normal method to delay */
    }                                        
    delay_us((uint32_t)(nms * 1000));                   /* Normal delay */
}

#else  /* When not using OS, use the following code */

/**
 * @brief       Delay nus
 * @param       nus: Delay time in us.
 * @note        nus value range: 0~190887435 (maximum value: 2^32 / fac_us @fac_us = 21)
 * @retval      None
 */
void delay_us(uint32_t nus)
{
    uint32_t ticks;
    uint32_t told, tnow, tcnt = 0;
    uint32_t reload = SysTick->LOAD;        /* LOAD value */
    ticks = nus * g_fac_us;                 /* Required number of ticks */
    told = SysTick->VAL;                    /* Get the current value of the counter */
    while (1)
    {
        tnow = SysTick->VAL;
        if (tnow != told)
        {
            if (tnow < told)
            {
                tcnt += told - tnow;        /* Note: SYSTICK is a down counter, so subtract */
            }
            else 
            {
                tcnt += reload - tnow + told;
            }
            told = tnow;
            if (tcnt >= ticks)
            {
                break;                      /* Time up/meet the required delay time, exit the loop */
            }
        }
    }
}

/**
 * @brief       Delay nms
 * @param       nms: Delay time in ms (0< nms <= 65535)
 * @retval      None
 */
void delay_ms(uint16_t nms)
{
    uint32_t repeat = nms / 30;     /* Divide by 30, which is to prevent too many loops from affecting performance */
    uint32_t remain = nms % 30;

    while (repeat)
    {
        delay_us(30 * 1000);        /* Use delay_us to implement 30ms delay */
        repeat--;
    }

    if (remain)
    {
        delay_us(remain * 1000);    /* Use delay_us to implement the remaining delay (remain ms) */
    }
}

/**
 * @brief       Delay function used internally by HAL
 * @note        HAL's delay function defaults to using Systick interrupt. If we don't use Systick interrupt, the HAL delay function won't work properly
 * @param       Delay : Delay time in milliseconds
 * @retval      None
 */
void HAL_Delay(uint32_t Delay)
{
     delay_ms(Delay);
}
#endif









