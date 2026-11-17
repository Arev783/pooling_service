const {
    pool,
    withTransaction
} = require('../config/db');
const AppError = require('../utils/AppError');

function isPollClosed(poll) {
    if (poll.is_closed) return true;
    if (poll.closes_at && new Date(poll.closes_at) <= new Date()) return true;
    return false;
}

function normalizeVoterId(voterId) {
    if (!voterId || !String(voterId).trim()) {
        throw new AppError(400, 'voter_id is required');
    }

    return String(voterId).trim();
}

async function createPoll({
    question,
    options,
    allow_multiple = false,
    closes_at = null,
    created_by
}) {
    if (!question || !String(question).trim()) {
        throw new AppError(400, 'Question is required');
    }

    if (!created_by || !String(created_by).trim()) {
        throw new AppError(400, 'created_by is required');
    }

    if (!Array.isArray(options) || options.length < 2) {
        throw new AppError(400, 'A poll must have at least 2 options');
    }

    const cleanOptions = options.map((option, index) => {
        const text = typeof option === 'string' ? option.trim() : String(option || '').trim();

        if (!text) {
            throw new AppError(400, `Option ${index + 1} cannot be empty`);
        }

        return {
            id: index + 1,
            text
        };
    });

    if (closes_at && new Date(closes_at).getTime() <= Date.now()) {
        throw new AppError(400, 'closes_at must be in the future');
    }

    return withTransaction(async (client) => {
        const pollRes = await client.query(
            `INSERT INTO polls (question, allow_multiple, closes_at, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING id, question, allow_multiple, closes_at, created_by, is_closed, created_at`,
            [
                String(question).trim(),
                Boolean(allow_multiple),
                closes_at ? new Date(closes_at).toISOString() : null,
                String(created_by).trim(),
            ]
        );

        const poll = pollRes.rows[0];
        const savedOptions = [];

        for (const option of cleanOptions) {
            await client.query(
                'INSERT INTO poll_options (poll_id, id, text) VALUES ($1, $2, $3)',
                [poll.id, option.id, option.text]
            );

            savedOptions.push({
                id: option.id,
                text: option.text
            });
        }

        return {
            ...poll,
            options: savedOptions
        };
    });
}

async function getPollById(id) {
    const pollRes = await pool.query(
        `SELECT id, question, allow_multiple, closes_at, created_by, is_closed, created_at
         FROM polls WHERE id = $1`,
        [id]
    );

    if (pollRes.rows.length === 0) {
        throw new AppError(404, 'Poll not found');
    }

    const optionRes = await pool.query(
        'SELECT id, text FROM poll_options WHERE poll_id = $1 ORDER BY id',
        [id]
    );

    return {
        ...pollRes.rows[0],
        options: optionRes.rows
    };
}

async function getOpenPollForVoting(client, pollId) {
    const res = await client.query(
        `SELECT id, allow_multiple, closes_at, is_closed
         FROM polls WHERE id = $1 FOR SHARE`,
        [pollId]
    );

    if (res.rows.length === 0) {
        throw new AppError(404, 'Poll not found');
    }

    const poll = res.rows[0];

    if (isPollClosed(poll)) {
        throw new AppError(409, 'Poll is closed');
    }

    return poll;
}

async function assertValidOptions(client, poll, optionIds) {
    if (!Array.isArray(optionIds) || optionIds.length === 0) {
        throw new AppError(400, 'Please provide at least one option');
    }

    const normalizedIds = optionIds.map(Number);

    if (normalizedIds.some((id) => Number.isNaN(id) || id < 1)) {
        throw new AppError(400, 'Invalid option id provided');
    }

    if (!poll.allow_multiple && normalizedIds.length > 1) {
        throw new AppError(400, 'This poll allows only one option');
    }

    const res = await client.query(
        'SELECT id FROM poll_options WHERE poll_id = $1 AND id = ANY($2::int[])',
        [poll.id, normalizedIds]
    );

    const validIds = new Set(res.rows.map((row) => Number(row.id)));
    const invalidIds = normalizedIds.filter((id) => !validIds.has(id));

    if (invalidIds.length > 0) {
        throw new AppError(400, 'Some option ids do not belong to this poll', {
            invalid_option_ids: invalidIds,
        });
    }
}

async function insertVoteOptions(client, pollId, voterId, optionIds) {
    await client.query(
        `INSERT INTO vote_options (poll_id, voter_id, option_id)
         SELECT $1, $2, unnest($3::int[])`,
        [pollId, voterId, optionIds]
    );
}

async function castVote(pollId, {
    voter_id,
    option_ids
}) {
    const voterId = normalizeVoterId(voter_id);
    const optionIds = Array.isArray(option_ids) ? option_ids : [option_ids];

    return withTransaction(async (client) => {
        const poll = await getOpenPollForVoting(client, pollId);
        await assertValidOptions(client, poll, optionIds);

        let votedAt;

        try {
            const res = await client.query(
                'INSERT INTO votes (poll_id, voter_id) VALUES ($1, $2) RETURNING voted_at',
                [pollId, voterId]
            );
            votedAt = res.rows[0].voted_at;
        } catch (err) {
            if (err.code === '23505') {
                throw new AppError(409, 'User has already voted in this poll. Use PUT to change the vote');
            }
            throw err;
        }

        await insertVoteOptions(client, pollId, voterId, optionIds);

        return {
            poll_id: pollId,
            voter_id: voterId,
            option_ids: optionIds,
            voted_at: votedAt,
        };
    });
}

async function changeVote(pollId, voterId, {
    option_ids
}) {
    const normalizedVoterId = normalizeVoterId(voterId);
    const optionIds = Array.isArray(option_ids) ? option_ids : [option_ids];

    return withTransaction(async (client) => {
        const poll = await getOpenPollForVoting(client, pollId);

        const voteRes = await client.query(
            'SELECT 1 FROM votes WHERE poll_id = $1 AND voter_id = $2 FOR UPDATE',
            [pollId, normalizedVoterId]
        );

        if (voteRes.rows.length === 0) {
            throw new AppError(404, 'Vote not found for this voter. Use POST to cast a vote');
        }

        await assertValidOptions(client, poll, optionIds);

        await client.query(
            'DELETE FROM vote_options WHERE poll_id = $1 AND voter_id = $2',
            [pollId, normalizedVoterId]
        );

        await insertVoteOptions(client, pollId, normalizedVoterId, optionIds);

        const upd = await client.query(
            'UPDATE votes SET voted_at = NOW() WHERE poll_id = $1 AND voter_id = $2 RETURNING voted_at',
            [pollId, normalizedVoterId]
        );

        return {
            poll_id: pollId,
            voter_id: normalizedVoterId,
            option_ids: optionIds,
            voted_at: upd.rows[0].voted_at,
        };
    });
}

async function getResults(pollId) {
    const poll = await getPollById(pollId);

    const res = await pool.query(
        `SELECT o.id AS option_id, o.text, COUNT(vo.option_id)::int AS count
         FROM poll_options o
         LEFT JOIN vote_options vo
         ON vo.poll_id = o.poll_id AND vo.option_id = o.id
         WHERE o.poll_id = $1
         GROUP BY o.id, o.text
         ORDER BY o.id`,
        [pollId]
    );

    const votersRes = await pool.query(
        'SELECT COUNT(*)::int AS total FROM votes WHERE poll_id = $1',
        [pollId]
    );

    const totalVotes = res.rows.reduce((sum, row) => sum + Number(row.count), 0);

    const results = res.rows.map((row) => ({
        option_id: Number(row.option_id),
        text: row.text,
        count: Number(row.count),
        percentage: totalVotes === 0 ? 0 : Math.round((Number(row.count) / totalVotes) * 10000) / 100,
    }));

    return {
        poll_id: poll.id,
        question: poll.question,
        is_closed: isPollClosed(poll),
        total_voters: Number(votersRes.rows[0].total),
        total_votes: totalVotes,
        results,
    };
}

async function closePoll(pollId, userId) {
    return withTransaction(async (client) => {
        const res = await client.query(
            'SELECT created_by, is_closed FROM polls WHERE id = $1 FOR UPDATE',
            [pollId]
        );

        if (res.rows.length === 0) {
            throw new AppError(404, 'Poll not found');
        }

        const poll = res.rows[0];

        if (String(poll.created_by).trim() !== String(userId).trim()) {
            throw new AppError(403, 'Only the creator of the poll can close it');
        }

        if (poll.is_closed) {
            throw new AppError(409, 'Poll is already closed');
        }

        await client.query('UPDATE polls SET is_closed = TRUE WHERE id = $1', [pollId]);
    }).then(() => getPollById(pollId));
}

module.exports = {
    createPoll,
    getPollById,
    castVote,
    changeVote,
    getResults,
    closePoll,
    isPollClosed,
};