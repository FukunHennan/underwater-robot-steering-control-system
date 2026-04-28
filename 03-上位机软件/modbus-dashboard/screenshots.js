const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// 配置
const BASE_URL = 'http://localhost:5175';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');
const PAGES = [
  { name: '01-姿态监控', selector: 'button[title="姿态"]' },
  { name: '02-ADC校准', selector: 'button[title="ADC"]' },
  { name: '03-PWM控制', selector: 'button[title="PWM"]' },
  { name: '04-舵机补偿', selector: 'button[title="补偿"]' },
  { name: '05-GPIO扩展', selector: 'button[title="GPIO"]' },
  { name: '06-红外遥控', selector: 'button[title="IR"]' },
];

async function takeScreenshots() {
  console.log('🚀 启动浏览器...');
  const browser = await puppeteer.launch({
    headless: false, // 显示浏览器窗口
    slowMo: 500, // 放慢操作速度便于观察
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // 创建输出目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  try {
    console.log(`📍 访问 ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    
    // 等待页面加载
    await page.waitForTimeout(2000);

    for (const pageInfo of PAGES) {
      console.log(`📸 截取 ${pageInfo.name}...`);
      
      try {
        // 点击标签页按钮
        const button = await page.$(pageInfo.selector);
        if (button) {
          await button.click();
          await page.waitForTimeout(1500); // 等待页面渲染
        }

        // 截图
        const screenshotPath = path.join(OUTPUT_DIR, `${pageInfo.name}.png`);
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: 'png'
        });
        
        console.log(`✅ 已保存: ${screenshotPath}`);
      } catch (err) {
        console.error(`❌ 截取 ${pageInfo.name} 失败:`, err.message);
      }
    }

    console.log('\n🎉 所有截图完成！');
    console.log(`📁 截图保存在: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ 截图过程出错:', error);
  } finally {
    await browser.close();
  }
}

// 运行
takeScreenshots();
