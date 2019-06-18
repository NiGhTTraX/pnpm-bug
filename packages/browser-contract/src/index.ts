import { Browser } from 'mugshot';
import { expect } from 'chai';
import Jimp from 'jimp';
import { ElementNotFound } from '../../mugshot/src/interfaces/browser';

export interface BrowserToBeAdapted {
  url: (path: string) => Promise<any>;
  execute: (func: (...args: any[]) => any) => Promise<any>;
  setWindowSize: (width: number, height: number) => Promise<any>;
  setWindowRect: (x: number, y: number, width: number, height: number) => Promise<any>;
}

export type BrowserContractTest = {
  name: string;

  /**
   * Get the test implementation that will throw an `AssertionError` on failure.
   *
   * @param browser The browser you're adapting. It will be used to navigate to
   *   a test fixture and resize the window.
   * @param adapter The browser adapter.
   */
  getTest: (browser: BrowserToBeAdapted, adapter: Browser) => () => Promise<void>;
}

/* istanbul ignore next because it will be stringified */
function getBrowserChromeSize() {
  return {
    width: window.outerWidth - window.innerWidth,
    height: window.outerHeight - window.innerHeight
  };
}

async function setViewportSize(browser: BrowserToBeAdapted, width: number, height: number) {
  const {
    // @ts-ignore because the return type is not properly inferred
    width: chromeWidth,
    // @ts-ignore
    height: chromeHeight
  } = await browser.execute(getBrowserChromeSize);

  const actualWidth = width + chromeWidth;
  const actualHeight = height + chromeHeight;

  // Chrome...
  await browser.setWindowSize(actualWidth, actualHeight);

  // Firefox...
  try {
    await browser.setWindowRect(0, 0, actualWidth, actualHeight);
    // eslint-disable-next-line no-empty
  } catch (e) {
  }
}

async function loadFixture(browser: BrowserToBeAdapted, name: string) {
  await browser.url(`file:///var/www/html/${name}.html`);

  await setViewportSize(browser, 1024, 768);
}

const browserContractTests: BrowserContractTest[] = [{
  name: 'should take a viewport screenshot',
  getTest(browser: BrowserToBeAdapted, adapter: Browser) {
    return async () => {
      await loadFixture(browser, 'simple');

      const screenshot = await Jimp.read(Buffer.from(await adapter.takeScreenshot(), 'base64'));

      expect(screenshot.getWidth()).to.equal(1024);
      expect(screenshot.getHeight()).to.equal(768);
    };
  }
}, {
  name: 'should take a viewport screenshot with absolutely positioned elements',
  getTest(browser: BrowserToBeAdapted, adapter: Browser) {
    return async () => {
      await loadFixture(browser, 'rect');

      const screenshot = await Jimp.read(Buffer.from(await adapter.takeScreenshot(), 'base64'));

      expect(screenshot.getWidth()).to.equal(1024);
      expect(screenshot.getHeight()).to.equal(768);
    };
  }
}, {
  name: 'should get bounding rect of element',
  getTest(browser: BrowserToBeAdapted, adapter: Browser) {
    return async () => {
      await loadFixture(browser, 'rect');

      const rect = await adapter.getElementRect('.test');

      // Include margin.
      expect(rect.x).to.equal(8 + 3);
      expect(rect.y).to.equal(10 + 3);

      // Include border and padding.
      expect(rect.width).to.equal(100 + 2 * 2 + 4 * 2);
      expect(rect.height).to.equal(100 + 2 * 2 + 4 * 2);
    };
  }
}, {
  name: 'should get bounding rect of off-screen element',
  getTest(browser: BrowserToBeAdapted, adapter: Browser) {
    return async () => {
      await loadFixture(browser, 'rect-scroll');

      const rect = await adapter.getElementRect('.test');

      expect(rect.x).to.equal(2000);
      expect(rect.y).to.equal(2000);
    };
  }
}, {
  name: 'should get bounding rect of missing element',
  getTest(browser: BrowserToBeAdapted, adapter: Browser) {
    return async () => {
      await loadFixture(browser, 'rect-scroll');

      let caughtError!: ElementNotFound;

      try {
        await adapter.getElementRect('.missing');
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).to.be.instanceOf(ElementNotFound);
      expect(caughtError.message).to.contain('.missing');
    };
  }
}];

export default browserContractTests;
