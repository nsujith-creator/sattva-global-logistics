-- Trade Advisory table
-- Stores the latest shipping advisory content, updated twice daily via Edge Function
-- Only ONE active row at a time (id = 'current')

CREATE TABLE IF NOT EXISTS trade_advisory (
  id            TEXT PRIMARY KEY DEFAULT 'current',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    TEXT NOT NULL DEFAULT 'cowork-digest',
  situation     TEXT NOT NULL DEFAULT '',
  carrier_notes JSONB NOT NULL DEFAULT '[]',
  surcharges    JSONB NOT NULL DEFAULT '[]',
  india_impact  TEXT NOT NULL DEFAULT '',
  source_tags   TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE trade_advisory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_advisory"
  ON trade_advisory FOR SELECT
  USING (true);

CREATE POLICY "service_write_advisory"
  ON trade_advisory FOR ALL
  USING (auth.role() = 'service_role');

INSERT INTO trade_advisory (id, situation, india_impact)
VALUES (
  'current',
  'No active advisory. Trade lanes operating normally.',
  'No India-specific impact at this time.'
) ON CONFLICT (id) DO NOTHING;
