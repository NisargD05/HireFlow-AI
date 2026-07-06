const express = require("express");
const {
  tallyWebhook,
  typeformWebhook
} = require("../controllers/externalApplicationController");

const router = express.Router();

router.post("/tally", tallyWebhook);
router.post("/typeform", typeformWebhook);

module.exports = router;
