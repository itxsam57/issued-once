'use client';

import { FormEvent, useState } from 'react';
import styles from './ops.module.css';

export function OpsLogin() {
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = String(form.get('token') ?? '');
    setState('working');
    const response = await fetch('/ops/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    if (!response?.ok) {
      setState('failed');
      return;
    }
    window.location.reload();
  }

  return (
    <main className={styles.loginShell}>
      <form className={styles.login} onSubmit={submit}>
        <p className={styles.signal}>ISSUED ONCE / OPERATIONS</p>
        <h1>Private room.</h1>
        <label>
          <span>Owner key</span>
          <input name="token" type="password" autoComplete="current-password" required />
        </label>
        {state === 'failed' ? <p role="alert">That key did not open it.</p> : null}
        <button type="submit" disabled={state === 'working'}>{state === 'working' ? 'OPENING' : 'ENTER'}</button>
      </form>
    </main>
  );
}
