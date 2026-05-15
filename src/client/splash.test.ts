import { afterEach, describe, expect, it, vi } from 'vitest';

let requestExpandedModeMock: ReturnType<typeof vi.fn>;

vi.mock('@devvit/web/client', () => {
  requestExpandedModeMock = vi.fn();

  return {
    context: {
      subredditName: 'testsub',
      username: 'test-user',
    },
    requestExpandedMode: requestExpandedModeMock,
  };
});

afterEach(() => {
  requestExpandedModeMock?.mockReset();
});

describe('Splash', () => {
  it('opens the expanded dashboard', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('./splash');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const openButton = Array.from(document.querySelectorAll('button')).find(
      (button) => /open/i.test(button.textContent ?? '')
    );
    expect(openButton).toBeTruthy();

    openButton!.click();

    expect(requestExpandedModeMock).toHaveBeenCalledTimes(1);
  });
});
