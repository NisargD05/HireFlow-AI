const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

require("../src/models/Interview");
const InterviewRequest = require("../src/models/InterviewRequest");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const requests = await InterviewRequest.find({ interviewId: { $ne: null } }).populate(
    "interviewId",
    "emailStatus"
  );

  let updated = 0;
  for (const request of requests) {
    const status = request.interviewId?.emailStatus;
    if (status?.error) {
      request.emailStatus = status;
      request.status = "email_failed";
      await request.save();
      updated += 1;
    } else if (status?.interviewer === "sent" && status?.candidate === "sent") {
      request.emailStatus = status;
      request.status = "email_sent";
      await request.save();
      updated += 1;
    }
  }

  console.log(JSON.stringify({ updated }, null, 2));
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
