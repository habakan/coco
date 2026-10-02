import { DurableObject } from 'cloudflare:workers';

export class TestWalletObject extends DurableObject {}

export default {
  async fetch() {
    return new Response('ok');
  },
};
