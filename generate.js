#!/usr/bin/env node
// Fetches Jamison Park facility availability from the Penrith booking API
// and stamps it into template.html -> index.html.
// Runs server-side (no CORS issues). Used by the GitHub Action.

'use strict';

const fs      = require('fs');
const path    = require('path');

const API_BASE      = 'https://mybookings.penrith.city/bookingportal/';
const SALES_CHANNEL = 5;
const BOOKING_TYPE  = 1;
const DAYS_AHEAD    = 28;
const BATCH_SIZE    = 10;

const HEADERS = {
  'Accept':       'application/json',
  'Content-Type': 'application/json',
  'Token':        '',
  'Language':     'en'
};

async function apiFetch(path) {
  const res = await fetch(API_BASE + path, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path.substring(0, 80)}`);
  const wrapper = await res.json();
  return JSON.parse(wrapper.data);
}

function isoDate(d) { return d.toISOString().split('T')[0]; }

async function main() {
  console.log('Fetching facilities...');

  // 1. All three facility pages in parallel
  const pages = await Promise.all(
    [1, 2, 3].map(p => apiFetch(
      `api/assets/invoke?id=100&page.number=${p}&page.size=100` +
      `&assetSearchFilter.assetClassId=1&assetSearchFilter.activeStatus=1` +
      `&assetSearchFilter.BookingTypeIds=${BOOKING_TYPE}` +
      `&assetSearchFilter.saleschannelId=${SALES_CHANNEL}` +
      `&include=venue`
    ))
  );

  const jFacs = pages.flatMap(p => p.data)
                     .filter(f => f.attributes.name.includes('Jamison'));
  console.log(`Found ${jFacs.length} Jamison Park facilities`);

  // 2. Rolling date window
  const today    = new Date();
  const fromDate = isoDate(today);
  const toDate   = isoDate(new Date(today.getTime() + DAYS_AHEAD * 86400000));
  console.log(`Date window: ${fromDate} to ${toDate}`);

  // 3. Timeslots in batches
  const slotMap = {};
  for (let i = 0; i < jFacs.length; i += BATCH_SIZE) {
    const batch = jFacs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(f =>
        apiFetch(
          `api/assets/invoke?id=102` +
          `&timeSlotSearchFilter.FromDate=${fromDate}` +
          `&timeSlotSearchFilter.ToDate=${toDate}` +
          `&assetId=${f.id}`
        )
        .then(d  => ({ id: f.id, slots: d.data || [] }))
        .catch(e => { console.warn(`  Skipped ${f.id}: ${e.message}`); return { id: f.id, slots: [] }; })
      )
    );
    results.forEach(r => { slotMap[r.id] = r.slots; });
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, jFacs.length)}/${jFacs.length} done\r`);
  }
  console.log('');

  // 4. Build clean data object
  const data = {};
  jFacs.forEach(f => {
    data[f.id] = {
      id:       f.id,
      name:     f.attributes.name.trim(),
      category: f.attributes.facilityCategory || 'Other',
      slots:    (slotMap[f.id] || []).map(s => ({
        start:       s.attributes.startTime,
        end:         s.attributes.endTime,
        available:   s.attributes.availableQuantity,
        capacity:    s.attributes.capacity,
        allocated:   s.attributes.allocatedQuantity,
        preliminary: s.attributes.preliminary
      }))
    };
  });

  // 5. Stamp into template
  const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const generated = template
    .replace('__DATA_PLACEHOLDER__', JSON.stringify(data))
    .replace('__GENERATED_AT__', new Date().toISOString());

  fs.writeFileSync(path.join(__dirname, 'index.html'), generated, 'utf8');
  console.log(`Written index.html (${Math.round(generated.length / 1024)}KB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
