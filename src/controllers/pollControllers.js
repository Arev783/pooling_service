const pollService = require('../services/pollService');

async function createPoll(req, res, next) {
try {
const poll = await pollService.createPoll(req.body);
res.status(201).json(poll);
} catch (err) {
next(err);
}
}

async function getPoll(req, res, next) {
try {
const poll = await pollService.getPollById(req.pollId);
res.status(200).json(poll);
} catch (err) {
next(err);
}
}

async function castVote(req, res, next) {
try {
const vote = await pollService.castVote(req.pollId, req.body);
res.status(201).json(vote);
} catch (err) {
next(err);
}
}

async function changeVote(req, res, next) {
try {
const vote = await pollService.changeVote(req.pollId, req.voterId, req.body);
res.status(200).json(vote);
} catch (err) {
next(err);
}
}

async function getResults(req, res, next) {
try {
const results = await pollService.getResults(req.pollId);
res.status(200).json(results);
} catch (err) {
next(err);
}
}

async function closePoll(req, res, next) {
try {
const poll = await pollService.closePoll(req.pollId, req.body.user_id);
res.status(200).json(poll);
} catch (err) {
next(err);
}
}

module.exports = { createPoll, getPoll, castVote, changeVote, getResults, closePoll };