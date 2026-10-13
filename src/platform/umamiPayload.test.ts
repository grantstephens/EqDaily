import { buildUmamiPayload, UMAMI_ENDPOINT, UMAMI_WEBSITE_ID } from './umamiPayload';

test('a screen view is a pageview for the screen name and the platform, nothing else', () => {
  expect(buildUmamiPayload('Insights', 'android')).toEqual({
    type: 'event',
    payload: { website: UMAMI_WEBSITE_ID, hostname: 'android', url: '/Insights' },
  });
});

test('there is no event name, which would make it a custom event rather than a pageview', () => {
  expect(JSON.stringify(buildUmamiPayload('Today', 'web'))).not.toContain('"name"');
});

test('points at the EqDaily site on the hub13 Umami host', () => {
  expect(UMAMI_ENDPOINT).toBe('https://a7s.hub13.xyz/api/send');
  expect(UMAMI_WEBSITE_ID).toBe('4280d74b-6616-4758-be99-5d9169291449');
});
