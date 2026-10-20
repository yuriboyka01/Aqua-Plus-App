import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const ARTIFACT_DIR = 'C:\\Users\\nisan\\.gemini\\antigravity\\brain\\818296d0-4f2c-43a4-84b6-05f41a23b9d8';

async function run() {
  console.log('1. Launching Chrome in Mobile Emulation Viewport (390 x 844)...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\nisan\\AppData\\Local\\Temp\\chrome_e2e_profile_' + Date.now(),
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--window-size=390,844',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      if (res.ok) {
        const allTargets = await res.json();
        const appTarget = allTargets.find(t => t.url.includes('localhost:3000'));
        if (appTarget) {
          targets = [appTarget];
          break;
        } else if (allTargets.length > 0 && !targets) {
          const pageTarget = allTargets.find(t => t.type === 'page' && !t.url.startsWith('chrome'));
          if (pageTarget) targets = [pageTarget];
        }
      }
    } catch {}
  }

  if (!targets || !targets[0]) {
    console.error('Could not connect to Chrome debugging target');
    chrome.kill();
    process.exit(1);
  }

  const pageTarget = targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const reqId = id++;
      pending.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
    if (msg.method === 'Console.messageAdded') {
      console.log('[BROWSER CONSOLE]', msg.params.message.level, msg.params.message.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value !== undefined ? a.value : a.description || JSON.stringify(a)).join(' ');
      console.log('[PAGE LOG]', msg.params.type, args);
    }
    if (msg.method === 'Page.javascriptDialogOpening') {
      console.log('[DIALOG OPENED]', msg.params.type, msg.params.message);
      send('Page.handleJavaScriptDialog', { accept: true });
    }
  });

  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Console.enable');

  // Emulate iPhone 14 Pro Mobile Device Viewport & Touch
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
    hasTouch: true
  });
  await send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });

  console.log('2. Navigating to http://localhost:3000...');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 2500));

  console.log('3. Authenticating with authorized owner account (aquaplusrosales@gmail.com)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const passInput = document.querySelector('input[type="password"]');
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(passInput, 'TempPassword123!');
      passInput.dispatchEvent(new Event('input', { bubbles: true }));

      const select = document.querySelector('select');
      const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      selectSetter.call(select, 'aquaplusrosales@gmail.com');
      select.dispatchEvent(new Event('change', { bubbles: true }));

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 3000));

  console.log('4. Navigating to Customers Fleet...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const custNav = buttons.find(b => b.innerText && (b.innerText.includes('Customers') || b.innerText.includes('Customer Fleet')));
      if (custNav) custNav.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 1500));

  console.log('5. Opening Customer Modal and Submitting New Customer Profile...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addBtn = buttons.find(b => b.innerText && (b.innerText.includes('Add Customer') || b.innerText.includes('New Customer') || b.innerText.includes('Register')));
      if (addBtn) addBtn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 1500));

  const testName = 'M. Veerakumar';
  const testPhone = '9842177665';

  await send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.querySelector('form');
      if (!modal) return;

      const nameInput = Array.from(modal.querySelectorAll('input')).find(i => i.placeholder && i.placeholder.includes('Murugesan'));
      if (nameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(nameInput, ${JSON.stringify(testName)});
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const phoneInput = Array.from(modal.querySelectorAll('input')).find(i => i.placeholder && i.placeholder.includes('98421'));
      if (phoneInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(phoneInput, ${JSON.stringify(testPhone)});
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Check WhatsApp Consent checkbox
      const consentBox = modal.querySelector('input[type="checkbox"]');
      if (consentBox && !consentBox.checked) {
        consentBox.click();
      }

      // Click submit
      const saveBtn = Array.from(modal.querySelectorAll('button')).find(b => b.type === 'submit' || (b.innerText && b.innerText.includes('Save')));
      if (saveBtn) saveBtn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 3500));

  console.log('6. Verifying customer creation in customer list...');
  const customerListCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body.innerText;
      return {
        foundVeerakumar: bodyText.includes('Veerakumar'),
        foundPhone: bodyText.includes('9842177665'),
        modalStillOpen: !!document.querySelector('form')
      };
    })()`,
    returnByValue: true
  });
  console.log('Customer check result:', customerListCheck.result?.value);

  // Capture Customers Screenshot
  const custScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  const custScreenshotPath = resolve(ARTIFACT_DIR, 'e2e_mobile_customers.png');
  writeFileSync(custScreenshotPath, Buffer.from(custScreenshot.data, 'base64'));
  console.log('Customers screenshot saved to:', custScreenshotPath);

  console.log('7. Navigating to Settings Tab...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const settingsNav = buttons.find(b => b.innerText && (b.innerText.includes('Settings') || b.innerText.includes('Operations & Config')));
      if (settingsNav) settingsNav.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 2000));

  console.log('8. Triggering WhatsApp Gateway Live Test in Settings...');
  const triggerWaTest = await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const testBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('whatsapp gateway'));
      if (testBtn) {
        testBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        testBtn.click();
        return 'Clicked test button: ' + testBtn.innerText;
      }
      return 'Test button not found among buttons: ' + buttons.map(b => b.innerText).join(', ');
    })()`,
    returnByValue: true
  });
  console.log('Trigger WA test result:', triggerWaTest.result?.value);

  // Wait for Meta Cloud response
  await new Promise(r => setTimeout(r, 5000));

  const settingsCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const p = Array.from(document.querySelectorAll('p')).find(el => el.innerText && (el.innerText.includes('Accepted by Meta') || el.innerText.includes('Gateway response:') || el.innerText.includes('wamid')));
      return {
        outputFound: !!p,
        outputText: p ? p.innerText : null,
        bodySnippet: document.body.innerText.slice(0, 300)
      };
    })()`,
    returnByValue: true
  });
  console.log('Settings WA test result:', settingsCheck.result?.value);

  // Capture Settings Screenshot
  const settingsScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  const settingsScreenshotPath = resolve(ARTIFACT_DIR, 'e2e_mobile_settings.png');
  writeFileSync(settingsScreenshotPath, Buffer.from(settingsScreenshot.data, 'base64'));
  console.log('Settings screenshot saved to:', settingsScreenshotPath);

  chrome.kill();
  console.log('=== END TO END MOBILE VERIFICATION COMPLETE ===');
}

run().catch(err => {
  console.error('E2E run error:', err);
  process.exit(1);
});
