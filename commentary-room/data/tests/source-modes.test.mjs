import test from 'node:test';import assert from 'node:assert/strict';
import { loadFixture } from './helpers.mjs';
import { readLegacySnapshotSource } from '../sources/legacy-snapshot-source.mjs';
import { adaptToCommentaryMarketPacketV1 } from '../adapter/commentary-data-adapter.mjs';

test('16 legacy snapshot realtime-style input maps without production call',async()=>{const frames=await loadFixture('synthetic-derivation.json');const f=frames.at(-1);const row={id:'rt-1',captured_at:f.timestamp,source_updated_at:f.timestamp,payload:f.raw_payload};const env=readLegacySnapshotSource(row);assert.equal(env.mode,'REALTIME');const p=adaptToCommentaryMarketPacketV1(row,{history:[row]});assert.equal(p.meta.mode,'REALTIME');assert.equal(p.indexes.vnindex.last.value,1806);});
test('17 computation and commentary views are separate boundaries',async()=>{const f=await loadFixture('synthetic-derivation.json');const { buildAdapterResult }=await import('../adapter/commentary-data-adapter.mjs');const r=buildAdapterResult(f.at(-1),{history:f});assert.ok(r.computation_view.sectors.length>=2);assert.ok(r.commentary_view.sectors.length<=8);assert.ok(!('raw_payload'in r.commentary_view));});
