#include "sys.h"
#include "delay.h"
#include "usart.h"
#include "demo.h"

/**
 * @brief       Show demo information
 * @param       None
 * @retval      None
 */
void show_mesg(void)
{
    /* Print demo information */
    printf("\n");
    printf("********************************\r\n");
    printf("STM32\r\n");
    printf("ATK-MS901M\r\n");
    printf("ATOM@ALIENTEK\r\n");
    printf("********************************\r\n");
    printf("\r\n");
}

int main(void)
{
    HAL_Init();                         /* Initialize HAL library */
    sys_stm32_clock_init(336, 8, 2, 7); /* Configure clock, 168Mhz */
    delay_init(168);                    /* Initialize delay */
    usart_init(115200);                 /* Initialize debug UART to 115200 */
    show_mesg();                        /* Show demo information */
    demo_run();                         /* Run demo program */
}
