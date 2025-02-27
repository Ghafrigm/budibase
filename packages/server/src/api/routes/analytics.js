const Router = require("@koa/router")
const controller = require("../controllers/analytics")

const router = Router()

router.get("/api/bbtel", controller.isEnabled)
router.post("/api/bbtel/ping", controller.ping)

module.exports = router
