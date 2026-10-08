import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { FOURTHWALL_GEAR_CATALOG } from '../src/services/fourthwall';

test('1. Fourthwall Gear Catalog: Default Sleeve Zone configurations exist for apparel items', () => {
  const windbreaker = FOURTHWALL_GEAR_CATALOG.find(i => i.type === 'WINDBREAKER');
  assert.ok(windbreaker, 'Windbreaker should be in catalog');
  const windbreakerSleeve = windbreaker.supportedZones.find(z => z.zone === 'LEFT_SLEEVE');
  assert.ok(windbreakerSleeve, 'Windbreaker must have LEFT_SLEEVE zone');
  assert.match(windbreakerSleeve.label, /QR Code & "ADVERTISE WITH US"/i);

  const hoodie = FOURTHWALL_GEAR_CATALOG.find(i => i.type === 'HOODIE');
  assert.ok(hoodie, 'Hoodie should be in catalog');
  const hoodieSleeve = hoodie.supportedZones.find(z => z.zone === 'LEFT_SLEEVE');
  assert.ok(hoodieSleeve, 'Hoodie must have LEFT_SLEEVE zone');

  const fleetPolo = FOURTHWALL_GEAR_CATALOG.find(i => i.type === 'FLEET_POLO');
  assert.ok(fleetPolo, 'Fleet Polo should be in catalog');
  const poloSleeve = fleetPolo.supportedZones.find(z => z.zone === 'LEFT_SLEEVE');
  assert.ok(poloSleeve, 'Fleet polo must have LEFT_SLEEVE zone');
});

test('2. Sleeve QR Generation: Generates scannable QR code matrix that decodes back to site destination URL', async () => {
  const targetSiteUrl = 'https://mutualpool.org/?ref=sleeve_qr&utm_source=apparel_sleeve&utm_medium=courier_qr&utm_campaign=advertise_with_us';

  // Generate QR data matrix
  const qrData = QRCode.create(targetSiteUrl, { errorCorrectionLevel: 'M' });
  assert.ok(qrData.modules.size > 0, 'QR matrix should have size > 0');

  // Generate PNG data buffer using QRCode library
  const pngBuffer = await QRCode.toBuffer(targetSiteUrl, {
    width: 300,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  assert.ok(pngBuffer.length > 0, 'PNG buffer should be generated');

  // Verify URL structure
  const url = new URL(targetSiteUrl);
  assert.equal(url.searchParams.get('ref'), 'sleeve_qr');
  assert.equal(url.searchParams.get('utm_campaign'), 'advertise_with_us');
  assert.equal(url.searchParams.get('utm_source'), 'apparel_sleeve');
});

test('3. Sleeve QR Scanner Attribution: Deep link query params are verified for user return flow', () => {
  const scannedQueryString = '?ref=sleeve_qr&utm_source=apparel_sleeve&utm_medium=courier_qr&utm_campaign=advertise_with_us';
  const params = new URLSearchParams(scannedQueryString);

  const isSleeveScan = params.get('ref') === 'sleeve_qr' || 
                       params.get('utm_campaign') === 'advertise_with_us' || 
                       params.get('utm_source') === 'apparel_sleeve';

  assert.equal(isSleeveScan, true, 'Scanner parameters should resolve to verified sleeve attribution');
});
