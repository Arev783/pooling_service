const express = require('express');
const pollController = require('../controllers/pollControllers');
const {
validateCreatePoll,
validatePollIdParam,
validateVoterIdParam,
validateCastVote,
validateChangeVote,
validateClosePoll,
} = require('../validators/pollvalidator');

const router = express.Router();

router.post('/', validateCreatePoll, pollController.createPoll);
router.get('/:id', validatePollIdParam, pollController.getPoll);
router.post('/:id/votes', validatePollIdParam, validateCastVote, pollController.castVote);
router.put(
'/:id/votes/:voterId',
validatePollIdParam,
validateVoterIdParam,
validateChangeVote,
pollController.changeVote
);
router.get('/:id/results', validatePollIdParam, pollController.getResults);
router.post('/:id/close', validatePollIdParam, validateClosePoll, pollController.closePoll);

module.exports = router;