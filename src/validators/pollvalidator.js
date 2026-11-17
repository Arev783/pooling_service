const AppError = require('../utils/AppError');

const MAX_INT4 = 2147483647;

function validateCreatePoll(req, res, next) {
    const {
        question,
        options,
        allow_multiple,
        closes_at,
        created_by
    } = req.body || {};
    const errors = [];

    if (typeof question !== 'string' || question.trim() === '') {
        errors.push('question must be a non-empty string');
    }

    if (!Array.isArray(options) || options.length < 2) {
        errors.push('options must be an array with at least 2 items');
    } else if (options.length > 10) {
        errors.push('options must contain at most 10 items');
    } else {
        const allStrings = options.every((option) => typeof option === 'string' && option.trim() !== '');
        if (!allStrings) {
            errors.push('every option must be a non-empty string');
        } else {
            const unique = new Set(options.map((option) => option.trim().toLowerCase()));
            if (unique.size !== options.length) {
                errors.push('options must be unique');
            }
        }
    }

    if (allow_multiple !== undefined && typeof allow_multiple !== 'boolean') {
        errors.push('allow_multiple must be a boolean');
    }

    if (closes_at !== undefined && closes_at !== null) {
        const date = new Date(closes_at);
        if (Number.isNaN(date.getTime())) {
            errors.push('closes_at must be a valid date');
        } else if (date <= new Date()) {
            errors.push('closes_at must be in the future');
        }
    }

    if (typeof created_by !== 'string' || created_by.trim() === '') {
        errors.push('created_by must be a non-empty string');
    }

    if (errors.length > 0) {
        return next(new AppError(400, 'Validation failed', errors));
    }

    next();
}

function validatePollIdParam(req, res, next) {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0 || id > MAX_INT4) {
        return next(new AppError(400, 'Poll id must be a positive integer'));
    }

    req.pollId = id;
    next();
}

function validateVoterIdParam(req, res, next) {
    const voterId = req.params.voterId;

    if (typeof voterId !== 'string' || voterId.trim() === '' || voterId.length > 50) {
        return next(new AppError(400, 'voterId must be a non-empty string (max 50 characters)'));
    }

    req.voterId = voterId.trim();
    next();
}

function collectOptionIdsErrors(option_ids, errors) {
    if (!Array.isArray(option_ids) || option_ids.length === 0) {
        errors.push('option_ids must be a non-empty array');
        return;
    }

    if (!option_ids.every((id) => Number.isInteger(id) && id > 0 && id <= MAX_INT4)) {
        errors.push('every option id must be a positive integer');
    }

    if (new Set(option_ids).size !== option_ids.length) {
        errors.push('option_ids must not contain duplicates');
    }
}

function validateCastVote(req, res, next) {
    const {
        voter_id,
        option_ids
    } = req.body || {};
    const errors = [];

    if (typeof voter_id !== 'string' || voter_id.trim() === '') {
        errors.push('voter_id must be a non-empty string');
    } else if (voter_id.trim().length > 50) {
        errors.push('voter_id must be at most 50 characters');
    }

    collectOptionIdsErrors(option_ids, errors);

    if (errors.length > 0) {
        return next(new AppError(400, 'Validation failed', errors));
    }

    next();
}

function validateChangeVote(req, res, next) {
    const {
        option_ids
    } = req.body || {};
    const errors = [];

    collectOptionIdsErrors(option_ids, errors);

    if (errors.length > 0) {
        return next(new AppError(400, 'Validation failed', errors));
    }

    next();
}

function validateClosePoll(req, res, next) {
    const {
        user_id
    } = req.body || {};

    if (typeof user_id !== 'string' || user_id.trim() === '') {
        return next(new AppError(400, 'Validation failed', ['user_id must be a non-empty string']));
    }

    next();
}

module.exports = {
    validateCreatePoll,
    validatePollIdParam,
    validateVoterIdParam,
    validateCastVote,
    validateChangeVote,
    validateClosePoll,
};