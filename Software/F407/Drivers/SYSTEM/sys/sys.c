/**
 ****************************************************************************************************
 * @file        sys.c
 * @author      ALIENTEK
 * @version     V1.0
 * @date        2021-10-14
 * @brief       System initialization functions (clock configuration/interrupt configuration/GPIO operations)
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
 ****************************************************************************************************
 */

#include "sys.h"


/**
 * @brief       Set interrupt vector table offset
 * @param       baseaddr : Base address
 * @param       offset   : Offset value
 * @retval      None
 */
void sys_nvic_set_vector_table(uint32_t baseaddr, uint32_t offset)
{
    /* Set NVIC vector table offset register, VTOR[29:0], bit[29:0] valid */
    SCB->VTOR = baseaddr | (offset & (uint32_t)0xFFFFFE00);
}

/**
 * @brief       Execute WFI instruction (execute this instruction to enter sleep mode, wait for interrupt to wake up)
 * @param       None
 * @retval      None
 */
void sys_wfi_set(void)
{
    __ASM volatile("wfi");
}

/**
 * @brief       Disable all interrupts (except NMI and hard fault interrupts)
 * @param       None
 * @retval      None
 */
void sys_intx_disable(void)
{
    __ASM volatile("cpsid i");
}

/**
 * @brief       Enable all interrupts
 * @param       None
 * @retval      None
 */
void sys_intx_enable(void)
{
    __ASM volatile("cpsie i");
}

/**
 * @brief       Set main stack pointer
 * @note        This function is used in startup files, in MDK, it's actually not used
 * @param       addr: Stack pointer address
 * @retval      None
 */
void sys_msr_msp(uint32_t addr)
{
    __set_MSP(addr);    /* Set main stack pointer */
}

/**
 * @brief       Enter standby mode
 * @param       None
 * @retval      None
 */
void sys_standby(void)
{
    __HAL_RCC_PWR_CLK_ENABLE();    /* Enable power clock */
    SET_BIT(PWR->CR, PWR_CR_PDDS); /* Enter standby mode */
}

/**
 * @brief       System software reset
 * @param       None
 * @retval      None
 */
void sys_soft_reset(void)
{
    NVIC_SystemReset();
}

/**
 * @brief       Clock initialization function
 * @param       plln: PLL1 multiplication factor (PLL frequency), value range: 64~432.
 * @param       pllm: PLL1 pre-division factor (division before PLL), value range: 2~63.
 * @param       pllp: PLL1 p division factor (division after PLL), the divided frequency is the system clock, value range: 2,4,6,8. (Only 4 values!)
 * @param       pllq: PLL1 q division factor (division after PLL), value range: 2~15.
 * @note
 *
 *              Fvco: VCO frequency
 *              Fsys: System clock frequency, also the PLL1 p division frequency
 *              Fq:   PLL1 q division frequency
 *              Fs:   PLL input clock frequency, can be HSI, CSI, HSE, etc.
 *              Fvco = Fs * (plln / pllm);
 *              Fsys = Fvco / pllp = Fs * (plln / (pllm * pllp));
 *              Fq   = Fvco / pllq = Fs * (plln / (pllm * pllq));
 *
 *              When the external crystal is 8M, the recommended value: plln = 336, pllm = 8, pllp = 2, pllq = 7.
 *              Result: Fvco = 8 * (336 / 8) = 336Mhz
 *                   Fsys = pll1_p_ck = 336 / 2 = 168Mhz
 *                   Fq   = pll1_q_ck = 336 / 7 = 48
 *
 * @retval      Execution result: 0, success; 1, failure;
 */
uint8_t sys_stm32_clock_init(uint32_t plln, uint32_t pllm, uint32_t pllp, uint32_t pllq)
{
    HAL_StatusTypeDef ret = HAL_OK;
    RCC_ClkInitTypeDef rcc_clk_init_handle;
    RCC_OscInitTypeDef rcc_osc_init_handle;
    
    __HAL_RCC_PWR_CLK_ENABLE();                                         /* Enable PWR clock */
    
    /* The voltage scaling allows optimizing the power consumption when the device is
       clocked below the maximum system frequency, to update the voltage scaling value
       regarding system frequency refer to product datasheet.  */

    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);      /* VOS = 1, Scale1, 1.2V full voltage, FLASH can get the highest performance */

    /* Use HSE oscillator, select HSE as PLL clock source, and configure PLL1 to generate USB clock */
    rcc_osc_init_handle.OscillatorType = RCC_OSCILLATORTYPE_HSE;        /* Clock source is HSE */
    rcc_osc_init_handle.HSEState = RCC_HSE_ON;                          /* Turn on HSE */
    rcc_osc_init_handle.PLL.PLLState = RCC_PLL_ON;                      /* Turn on PLL */
    rcc_osc_init_handle.PLL.PLLSource = RCC_PLLSOURCE_HSE;              /* PLL clock source selects HSE */
    rcc_osc_init_handle.PLL.PLLN = plln;
    rcc_osc_init_handle.PLL.PLLM = pllm;
    rcc_osc_init_handle.PLL.PLLP = pllp;
    rcc_osc_init_handle.PLL.PLLQ = pllq;

    ret = HAL_RCC_OscConfig(&rcc_osc_init_handle);                      /* Initialize RCC */
    if(ret != HAL_OK)
    {
        return 1;                                                       /* Clock initialization failed, here you can add your own processing code */
    }

    /* Select PLL as system clock source, and configure HCLK, PCLK1 and PCLK2*/
    rcc_clk_init_handle.ClockType = ( RCC_CLOCKTYPE_SYSCLK \
                                    | RCC_CLOCKTYPE_HCLK \
                                    | RCC_CLOCKTYPE_PCLK1 \
                                    | RCC_CLOCKTYPE_PCLK2);

    rcc_clk_init_handle.SYSCLKSource   = RCC_SYSCLKSOURCE_PLLCLK;       /* Set system clock source to PLL */
    rcc_clk_init_handle.AHBCLKDivider  = RCC_SYSCLK_DIV1;               /* AHB division factor is 1 */
    rcc_clk_init_handle.APB1CLKDivider = RCC_HCLK_DIV4;                 /* APB1 division factor is 4 */
    rcc_clk_init_handle.APB2CLKDivider = RCC_HCLK_DIV2;                 /* APB2 division factor is 2 */

    ret = HAL_RCC_ClockConfig(&rcc_clk_init_handle, FLASH_LATENCY_5);   /* At the same time, set FLASH latency to 5WS (i.e., 6 CPU cycles) */
    if(ret != HAL_OK)
    {
        return 1;                                                       /* Clock initialization failed */
    }
    
    /* STM32F405x/407x/415x/417x Z version chip supports prefetch buffer */
    if (HAL_GetREVID() == 0x1001)
    {
        __HAL_FLASH_PREFETCH_BUFFER_ENABLE();                           /* Enable flash prefetch */
    }
    return 0;
}

#ifdef  USE_FULL_ASSERT

/**
 * @brief       Report the name of the source file and the source line number where the assert_param error has occurred.
 * @param       file: Pointer to the source file name
 *              line: Assertion error line number
 * @retval      None
 */
void assert_failed(uint8_t* file, uint32_t line)
{ 
    while (1)
    {
    }
}
#endif


