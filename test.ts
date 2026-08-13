import { addCalendar } from "./src/services/calendar.service";

const main = async () => {
  const result = await addCalendar({
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 24),
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 + 1000 * 60 * 30),
    name: "Test",
    email: "test@test.com",
    description: "Test",
    packageName: "Test",
    price: 100,
  });
  console.log(result);
};

main().catch(console.error);