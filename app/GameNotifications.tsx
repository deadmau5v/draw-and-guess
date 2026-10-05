'use client';

import React from 'react';
import { Toast } from '../web/src/components';
import { clearToast, useGame } from '../web/src/store';

export function GameNotifications() {
  const { message } = useGame();
  return <Toast message={message} onClose={clearToast} />;
}
