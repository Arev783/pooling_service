DROP TABLE IF EXISTS vote_options;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS poll_options;
DROP TABLE IF EXISTS polls;

CREATE TABLE polls (
id SERIAL PRIMARY KEY,
question TEXT NOT NULL,
allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
closes_at TIMESTAMPTZ,
created_by VARCHAR(100) NOT NULL,
is_closed BOOLEAN NOT NULL DEFAULT FALSE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE poll_options (
poll_id INT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
id INT NOT NULL,
text TEXT NOT NULL,
PRIMARY KEY (poll_id, id)
);

CREATE TABLE votes (
poll_id INT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
voter_id VARCHAR(50) NOT NULL,
voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
PRIMARY KEY (poll_id, voter_id)
);

CREATE TABLE vote_options (
poll_id INT NOT NULL,
voter_id VARCHAR(50) NOT NULL,
option_id INT NOT NULL,
PRIMARY KEY (poll_id, voter_id, option_id),
FOREIGN KEY (poll_id, voter_id) REFERENCES votes(poll_id, voter_id) ON DELETE CASCADE,
FOREIGN KEY (poll_id, option_id) REFERENCES poll_options(poll_id, id) ON DELETE CASCADE
);