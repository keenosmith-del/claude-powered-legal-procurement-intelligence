ALTER TABLE contract_terms ADD COLUMN active boolean NOT NULL DEFAULT true;
CREATE INDEX ON contract_terms(supplier_id) WHERE active;
