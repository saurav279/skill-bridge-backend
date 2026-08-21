import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { InstallmentController } from "../controllers/installment.controller";
import { UserController } from "../controllers/user.controller";
import { requireAdminAuth } from "../middleware/admin.middleware";

const router = Router();

router.post("/login", (req, res, next) => AdminController.login(req, res, next));
router.post("/otp", (req, res, next) =>
  AdminController.verifyOtp(req, res, next),
);

router.use(requireAdminAuth);

router.get("/assessments", (req, res, next) =>
  AdminController.listAssessments(req, res, next),
);
router.get("/assessments/:id", (req, res, next) =>
  AdminController.getAssessment(req, res, next),
);

router.get("/contact_messages", (req, res, next) =>
  AdminController.listContactMessages(req, res, next),
);
router.get("/contact_messages/:id", (req, res, next) =>
  AdminController.getContactMessage(req, res, next),
);

router.get("/package_purchases", (req, res, next) =>
  AdminController.listPackagePurchases(req, res, next),
);
router.get("/package_purchases/:id", (req, res, next) =>
  AdminController.getPackagePurchase(req, res, next),
);

router.post("/leads", (req, res, next) => AdminController.createLead(req, res, next));
router.get("/leads", (req, res, next) => AdminController.listLeads(req, res, next));
router.get("/leads/status", (req, res, next) =>
  AdminController.getLeadStatus(req, res, next),
);
router.get("/leads/:id", (req, res, next) => AdminController.getLead(req, res, next));
router.patch("/leads/:id", (req, res, next) =>
  AdminController.updateLead(req, res, next),
);
router.delete("/leads/:id", (req, res, next) =>
  AdminController.deleteLead(req, res, next),
);

router.post("/pipeline", (req, res, next) =>
  AdminController.createPipeline(req, res, next),
);

router.post("/notes", (req, res, next) => AdminController.createNote(req, res, next));
router.patch("/notes/:id", (req, res, next) =>
  AdminController.updateNote(req, res, next),
);

router.post("/users", (req, res, next) => UserController.create(req, res, next));
router.get("/users", (req, res, next) => UserController.list(req, res, next));
router.get("/users/:id", (req, res, next) => UserController.getById(req, res, next));
router.patch("/users/:id", (req, res, next) =>
  UserController.update(req, res, next),
);

router.post("/payment_plans", (req, res, next) =>
  InstallmentController.createPlan(req, res, next),
);
router.get("/payment_plans", (req, res, next) =>
  InstallmentController.listPlans(req, res, next),
);
router.get("/payment_plans/status", (req, res, next) =>
  InstallmentController.getPlanStatusCounts(req, res, next),
);
router.get("/payment_plans/:id", (req, res, next) =>
  InstallmentController.getPlan(req, res, next),
);
router.delete("/payment_plans/:id", (req, res, next) =>
  InstallmentController.cancelPlan(req, res, next),
);

router.get("/installments", (req, res, next) =>
  InstallmentController.list(req, res, next),
);
router.get("/installments/status", (req, res, next) =>
  InstallmentController.getStatusCounts(req, res, next),
);
router.get("/installments/:id", (req, res, next) =>
  InstallmentController.getById(req, res, next),
);
router.post("/installments/:id/checkout", (req, res, next) =>
  InstallmentController.createCheckout(req, res, next),
);
router.post("/installments/:id/email", (req, res, next) =>
  InstallmentController.sendEmail(req, res, next),
);
router.patch("/installments/:id", (req, res, next) =>
  InstallmentController.update(req, res, next),
);

export default router;
