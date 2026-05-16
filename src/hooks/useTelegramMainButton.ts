import { useEffect, useRef } from 'react';
import { useTelegram } from './useTelegram';

interface UseTelegramMainButtonOptions {
  visible: boolean;
  text?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

/**
 * Controls Telegram MainButton lifecycle for a screen.
 * Hides on unmount and when visible=false (browser: no-op).
 */
export function useTelegramMainButton({
  visible,
  text = 'Запустить workflow',
  disabled = false,
  loading = false,
  onClick,
}: UseTelegramMainButtonOptions): void {
  const { isTelegram, mainButton } = useTelegram();
  const onClickRef = useRef(onClick);

  onClickRef.current = onClick;

  useEffect(() => {
    if (!isTelegram || !visible) {
      mainButton.hide();
      return;
    }

    const handler = () => onClickRef.current();

    mainButton.setText(text);
    mainButton.show();

    if (loading) {
      mainButton.showProgress(true);
    } else {
      mainButton.hideProgress();
      if (disabled) {
        mainButton.disable();
      } else {
        mainButton.enable();
      }
    }

    mainButton.onClick(handler);

    return () => {
      mainButton.offClick(handler);
      mainButton.hideProgress();
      mainButton.hide();
    };
  }, [isTelegram, visible, text, disabled, loading, mainButton]);
}
