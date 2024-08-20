import express from "express";

const router = express.Router();

import * as categoryControllers from "../controllers/categoryController.js";
import * as productControllers from "../controllers/productController.js";

router.get("/", categoryControllers.index);

router
	.route("/categories/create")
	.get(categoryControllers.categoryCreateGet)
	.post(categoryControllers.categoryCreatePost);
router
	.route("/categories/:id/update")
	.get(categoryControllers.categoryUpdateGet)
	.post(categoryControllers.categoryUpdatePost);
router
	.route("/categories/:id/delete")
	.get(categoryControllers.categoryDeleteGet)
	.post(categoryControllers.categoryDeletePost);

router.get("/categories/:id", categoryControllers.categoryDetail);
router.get("/categories", categoryControllers.categoryList);

router
	.route("/products/create")
	.get(productControllers.productCreateGet)
	.post(productControllers.productCreatePost);
router
	.route("/products/:id/update")
	.get(productControllers.productUpdateGet)
	.post(productControllers.productUpdatePost);
router
	.route("/products/:id/delete")
	.get(productControllers.productDeleteGet)
	.post(productControllers.productDeletePost);
router.get("/products/:id", productControllers.productDetail);
router.get("/products", productControllers.productList);

export default router;
