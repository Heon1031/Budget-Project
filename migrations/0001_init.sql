-- 가구: 비밀번호에서 만든 확인값의 해시만 둔다. 비밀번호와 암호화 열쇠는 서버에 오지 않는다.
CREATE TABLE households (
  id TEXT PRIMARY KEY,
  auth_hash TEXT NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 기록: 내용(blob)은 폰에서 암호화한 글자다. seq는 가구마다 늘어나는 순번으로, 바뀐 것만 받아 갈 때 쓴다.
CREATE TABLE records (
  household_id TEXT NOT NULL,
  id TEXT NOT NULL,
  blob TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  PRIMARY KEY (household_id, id)
);

CREATE INDEX records_by_seq ON records (household_id, seq);
