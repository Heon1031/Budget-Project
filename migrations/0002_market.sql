-- 공개 시장 정보(한국은행 금리, 금융위원회 규제 소식). 개인 정보가 아니라 암호화하지 않는다.
CREATE TABLE market_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
