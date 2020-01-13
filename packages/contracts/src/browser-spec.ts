/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import Jimp from 'jimp';
import { Browser, ElementNotFoundError, ElementNotVisibleError } from 'mugshot';
import { fixtures } from './fixtures';

/**
 * Methods on the browser instance that these tests need.
 *
 * They're different from the ones from [[Browser]] because
 * the tests are concerned with navigating the browser to test
 * fixtures.
 */
export interface TestBrowser {
  /**
   * Navigate to an URL.
   */
  url: (path: string) => Promise<any>;
}

export interface BrowserContractTest {
  name: string;

  /**
   * Run the test which will throw an `AssertionError` on failure.
   *
   * @param browser The browser you're adapting. It will be used to navigate to
   *   a test fixture and resize the window.
   * @param adapter The browser adapter.
   */
  run: (browser: TestBrowser, adapter: Browser) => Promise<void>;
}

/* istanbul ignore next because this will get stringified and sent to the browser */
function createFixture(html: string) {
  // This should use `document.write` instead but Firefox gives an "insecure operation" error.
  document.body.innerHTML = html;
}

async function loadFixture(
  browser: TestBrowser,
  adapter: Browser,
  name: keyof typeof fixtures
) {
  const fixtureContent = fixtures[name];

  await browser.url('about:blank');

  await adapter.execute(createFixture, fixtureContent);

  await adapter.setViewportSize(1024, 768);
}

/**
 * Contract tests for the [[Browser]] interface.
 *
 * These exercise the [[Browser.takeScreenshot]] method, but they don't check
 * the actual screenshot content, only some basic properties. This is because
 * the tests can't assume any details about the environment in which they're
 * ran e.g. OS, actual browser instance, user profile etc.
 */
export const browserContractTests: BrowserContractTest[] = [
  {
    name: 'should take a viewport screenshot',
    run: async (browser: TestBrowser, adapter: Browser) => {
      await loadFixture(browser, adapter, 'simple');

      const screenshot = await Jimp.read(
        Buffer.from(await adapter.takeScreenshot(), 'base64')
      );

      expect(screenshot.getWidth()).to.equal(1024);
      expect(screenshot.getHeight()).to.equal(768);
    }
  },
  {
    name:
      'should take a viewport screenshot with absolutely positioned elements',
    run: async (browser: TestBrowser, adapter: Browser) => {
      await loadFixture(browser, adapter, 'rect');

      const screenshot = await Jimp.read(
        Buffer.from(await adapter.takeScreenshot(), 'base64')
      );

      expect(screenshot.getWidth()).to.equal(1024);
      expect(screenshot.getHeight()).to.equal(768);
    }
  },
  {
    name: 'should get bounding rect of element',
    run: async (browser: TestBrowser, adapter: Browser) => {
      await loadFixture(browser, adapter, 'rect');

      const rect = await adapter.getElementRect('.test');

      expect(rect).to.deep.equal({
        // Include margin.
        x: 8 + 3,
        y: 10 + 3,
        // Include border and padding.
        width: 100 + 2 * 2 + 4 * 2,
        height: 100 + 2 * 2 + 4 * 2
      });
    }
  },
  {
    name: 'should get bounding rect of off-screen element',
    run: async (browser: TestBrowser, adapter: Browser) => {
      await loadFixture(browser, adapter, 'rect-scroll');

      const rect = await adapter.getElementRect('.test');

      expect(rect).to.deep.equal({
        x: 2000,
        y: 2000,
        width: 100,
        height: 100
      });
    }
  },
  {
    name: 'should throw if element is missing',
    run: async (browser: TestBrowser, adapter: Browser) => {
      await loadFixture(browser, adapter, 'rect-scroll');

      let caughtError!: ElementNotFoundError;

      try {
        expect(await adapter.getElementRect('.missing')).to.be.undefined;
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).to.be.instanceOf(ElementNotFoundError);
      expect(caughtError.message).to.contain('.missing');
    }
  },
  {
    name: 'should get bounding rect of all matching elements',
    run: async (browser, adapter) => {
      await loadFixture(browser, adapter, 'rect-multiple');

      expect(await adapter.getElementRect('.multiple')).to.deep.equal([
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100, y: 0, width: 100, height: 100 },
        { x: 0, y: 100, width: 100, height: 100 },
        { x: 100, y: 100, width: 100, height: 100 }
      ]);
    }
  },
  {
    name: 'should throw if element is not visible',
    run: async (browser, adapter) => {
      await loadFixture(browser, adapter, 'rect-invisible');

      let caughtError!: ElementNotFoundError;

      try {
        expect(await adapter.getElementRect('#invisible')).to.be.undefined;
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).to.be.instanceOf(ElementNotVisibleError);
      expect(caughtError.message).to.contain('#invisible');
    }
  },
  {
    name: 'should throw if matching element is not visible',
    run: async (browser, adapter) => {
      await loadFixture(browser, adapter, 'rect-invisible');

      let caughtError!: ElementNotFoundError;

      try {
        expect(await adapter.getElementRect('div')).to.be.undefined;
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).to.be.instanceOf(ElementNotVisibleError);
      expect(caughtError.message).to.contain('div');
    }
  },
  {
    name: 'should execute a simple function',
    run: async (browser, adapter) => {
      await loadFixture(browser, adapter, 'simple');

      /* istanbul ignore next because this will get stringified and sent to the browser */
      const func = () => 23;

      expect(await adapter.execute(func)).to.equal(23);
    }
  },
  {
    name: 'should execute a simple function with args',
    run: async (browser, adapter) => {
      await loadFixture(browser, adapter, 'simple');

      /* istanbul ignore next because this will get stringified and sent to the browser */
      const func = (x: number) => x;

      expect(await adapter.execute(func, 42)).to.equal(42);
    }
  }
];