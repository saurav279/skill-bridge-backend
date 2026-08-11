import { S3Service } from "./src/services/s3.service";
(async () => {
  try {
    const resume = await S3Service.getResumeContentFromCloudinary("https://res.cloudinary.com/unfoldcloud/image/upload/v1730957482/resumes/resume-55781-1730957480891.pdf");
    console.log(resume.text);
  } catch (error) {
    console.error(error);
  }
})();

