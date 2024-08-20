import sharp from "sharp";
import multer from "multer";
import createError from "http-errors";
import asyncHandler from "express-async-handler";
import { validationResult, checkSchema, matchedData } from "express-validator";
import { Storage } from "@google-cloud/storage";

import db from "../config/database.js";
import { encodeFile, getImageUrl } from "../utils/handleImage.js";

const googleStorage = new Storage({
	credentials: {
		type: process.env.GADCTYPE,
		project_id: process.env.GADCID,
		private_key_id: process.env.GADCPRIVATEKEYID,
		private_key: process.env.GADCIDPRIVATEKEY.replace(/\\n/g, "\n"),
		client_email: process.env.GADCCLIENTEMAIL,
		client_id: process.env.GADCCLIENTID,
		auth_uri: process.env.GADCAUTHURI,
		token_uri: process.env.GADCTOKENURI,
		auth_provider_x509_cert_url: process.env.GADCAUTHPROVIDERX509,
		client_x509_cert_url: process.env.GADCCLIENTX509,
		universe_domain: process.env.GADCUNIVERSEDOMAIN,
	},
});
const bucketName = "project-inventory-user";
const uploadFile = multer({ storage: multer.memoryStorage() });

const productList = asyncHandler(async (req, res) => {
	const SQL = {
		text: `SELECT id, name FROM products
		WHERE expired = 'Infinity' OR  $1 < expired
		ORDER BY name;`,
		values: [new Date()],
	};

	const { rows: products } = await db.query(SQL.text, SQL.values);

	res.render("productList", {
		title: "Product List",
		products,
	});
});
const productDetail = asyncHandler(async (req, res, next) => {
	const SQL = {
		text: `
			SELECT products.*, categories.name AS category
			FROM products JOIN categories
			ON products.category_id = categories.id
			WHERE products.id= $1
		`,
		values: [req.params.id],
	};

	const { rows } = await db.query(SQL.text, SQL.values);
	const product = rows[0];

	const handleRender = () => {
		const imageURLs = {
			imageUrl: `https://storage.googleapis.com/${getImageUrl({
				product,
			})}`,
			imageUrl_300: `https://ik.imagekit.io/whitesgr03/${getImageUrl({
				product,
				size: 300,
			})}`,
			imageUrl_400: `https://ik.imagekit.io/whitesgr03/${getImageUrl({
				product,
				size: 400,
			})}`,
			imageUrl_600: `https://ik.imagekit.io/whitesgr03/${getImageUrl({
				product,
				size: 600,
			})}`,
		};
		res.render("productDetail", {
			product: {
				...product,
				...imageURLs,
			},
		});
	};

	rows.length
		? handleRender()
		: next(createError(404, "Category not found", { type: "category" }));
});
const productCreateGet = asyncHandler(async (req, res) => {
	const { rows: categories } = await db.query(
		`SELECT id, name FROM categories ORDER BY name;`
	);

	res.render("productForm", {
		title: "Add a new product",
		categories,
	});
});
const productCreatePost = [
	uploadFile.single("image"),
	asyncHandler(async (req, res) => {
		const { rows: categories } = await db.query(
			`SELECT id, name FROM categories ORDER BY name;`
		);

		const validationSchema = {
			name: {
				trim: true,
				isLength: {
					options: { max: 100 },
					errorMessage: "The name must be less than 100 long.",
					bail: true,
				},
				custom: {
					options: value =>
						new Promise(async (resolve, reject) => {
							const { rows: product } = await db.query(
								`SELECT EXISTS (SELECT name FROM products WHERE name = $1) AS exist;`,
								[value]
							);
							product[0].exist ? reject() : resolve();
						}),
					errorMessage: "The name is been used.",
				},
			},
			category: {
				custom: {
					options: value =>
						categories.find(
							category => category.id === Number(value)
						),
					errorMessage: "The category is required.",
				},
			},
			price: {
				isFloat: {
					options: { min: 1 },
					errorMessage: "The price is required.",
				},
			},
			quantity: {
				isInt: {
					options: { min: 1, max: 999 },
					errorMessage: "The quantity is required.",
				},
			},
			description: {
				trim: true,
				notEmpty: { errorMessage: "The description is required." },
			},
		};

		await checkSchema(validationSchema, ["body"]).run(req);
		const schemaErrors = validationResult(req);

		const { file } = req;
		const imageInfo =
			file?.mimetype === "image/jpeg" &&
			(await sharp(file.buffer).metadata());
		const imageError =
			!imageInfo ||
			imageInfo.size > 500000 ||
			imageInfo.width < 800 ||
			imageInfo.height < 800;

		const createProduct = async () => {
			const oneDay = 24 * 60 * 60;
			const product = matchedData(req);
			let productId = null;
			const uploadNewProductImage = async () => {
				const fileName = encodeFile(product.name);
				const handleImageBuffer = async () =>
					imageInfo.width === 800 && imageInfo.height === 800
						? file.buffer
						: await sharp(file.buffer)
								.resize({ width: 800, height: 800 })
								.jpeg({ mozjpeg: true })
								.toBuffer();

				await googleStorage
					.bucket(bucketName)
					.file(fileName)
					.save(await handleImageBuffer(), {
						metadata: {
							contentType: file.mimetype,
							cacheControl: `public, max-age=${oneDay}`,
						},
					});
			};
			const addNewProduct = async () => {
				const currentTime = new Date();

				const SQL = {
					text: `
						INSERT INTO products (name, description, category_id, price, quantity, modified, expired)
						VALUES ($1, $2, $3, $4, $5, $6, $7)
						RETURNING id;
					`,
					values: [
						product.name,
						product.description,
						Number(product.category),
						Number(product.price),
						Number(product.quantity),
						currentTime,
						new Date(currentTime.getTime() + oneDay * 1000),
					],
				};
				const { rows: newProduct } = await db.query(
					SQL.text,
					SQL.values
				);
				productId = newProduct[0].id;
			};
			await Promise.all([uploadNewProductImage(), addNewProduct()]);
			res.redirect(`/inventory/products/${productId}`);
		};
		const renderErrorMessages = () => {
			const errors = schemaErrors.mapped();
			imageError &&
				(errors.image = {
					msg: "The image is required, size must be less than 500 kb, width and height must be 800 or greater.",
				});

			res.render("productForm", {
				title: "Add a new product",
				categories,
				product: {
					...req.body,
					category_id: Number(req.body.category),
				},
				errors,
			});
		};
		schemaErrors.isEmpty() && !imageError
			? createProduct()
			: renderErrorMessages();
	}),
];
const productUpdateGet = asyncHandler(async (req, res, next) => {
	const SQL = {
		text: `
			SELECT products.*, categories.name AS category
			FROM products JOIN categories
			ON products.category_id = categories.id
			WHERE products.id= $1
		`,
		values: [req.params.id],
	};
	let [product, categories] = await Promise.all([
		db.query(SQL.text, SQL.values),
		db.query(`SELECT id, name FROM categories ORDER BY name;`),
	]);

	product.rows.length
		? product.rows[0].expired === Infinity
			? res.redirect(`/inventory/products/${product.rows[0].id}`)
			: res.render("productForm", {
					title: "Update product",
					categories: categories.rows,
					product: {
						...product.rows[0],
						imageUrl: `https://storage.googleapis.com/${getImageUrl(
							{ product: product.rows[0] }
						)}`,
					},
			  })
		: next(createError(404, "Product not found", { type: "product" }));
});
const productUpdatePost = [
	uploadFile.single("image"),
	asyncHandler(async (req, res, next) => {
		const SQL = {
			text: `
			SELECT products.*, categories.name AS category
			FROM products JOIN categories
			ON products.category_id = categories.id
			WHERE products.id= $1
		`,
			values: [req.params.id],
		};
		const [product, categories] = await Promise.all([
			db.query(SQL.text, SQL.values),
			db.query(`SELECT id, name FROM categories ORDER BY name;`),
		]);

		const validationFields = async () => {
			const validationSchema = {
				name: {
					trim: true,
					isLength: {
						options: { max: 100 },
						errorMessage: "The name must be less than 100 long.",
					},
					custom: {
						options: (value, { req }) =>
							new Promise(async (resolve, reject) => {
								const { rows: product } = await db.query(
									`SELECT EXISTS
									(SELECT name FROM products WHERE name= $1 AND id != $2)
									AS exist;`,
									[value, Number(req.params.id)]
								);
								product[0].exist ? reject() : resolve();
							}),
						errorMessage: "The name is been used.",
					},
				},
				category: {
					custom: {
						options: value =>
							categories.rows.find(
								category => category.id === Number(value)
							),
						errorMessage: "The category is required.",
					},
				},
				price: {
					isFloat: {
						options: { min: 1 },
						errorMessage: "The price is required.",
					},
				},
				quantity: {
					isInt: {
						options: { min: 1, max: 999 },
						errorMessage: "The quantity is required.",
					},
				},
				description: {
					trim: true,
					notEmpty: {
						errorMessage: "The description is required.",
					},
				},
			};

			await checkSchema(validationSchema, ["body"]).run(req);

			const schemaErrors = validationResult(req);

			const { file } = req;
			const imageInfo =
				file?.mimetype === "image/jpeg" &&
				(await sharp(file.buffer).metadata());
			const imageError =
				!imageInfo ||
				imageInfo.size > 500000 ||
				imageInfo.width < 800 ||
				imageInfo.height < 800;

			const updateProduct = async () => {
				const oneDay = 24 * 60 * 60;
				const oldProduct = product.rows[0];
				const newProduct = matchedData(req);

				const fileName = encodeFile(newProduct.name);
				const RenameProductImage = async () => {
					const oldFileName = encodeFile(oldProduct.name);
					await googleStorage
						.bucket(bucketName)
						.file(oldFileName)
						.move(fileName);
				};
				const handleUpdateImage = async () => {
					const handleImageBuffer = async () =>
						imageInfo.width === 800 && imageInfo.height === 800
							? file.buffer
							: await sharp(file.buffer)
									.resize({ width: 800, height: 800 })
									.jpeg({ mozjpeg: true })
									.toBuffer();
					await googleStorage
						.bucket(bucketName)
						.file(fileName)
						.save(await handleImageBuffer(), {
							metadata: {
								contentType: file.mimetype,
								cacheControl: `public, max-age=${oneDay}`,
							},
						});
				};
				const editProduct = async () => {
					const SQL = {
						text: `
							UPDATE products
							SET name= $1, description= $2, category_id= $3, price= $4, quantity= $5, modified= $6 
							WHERE id= $7;
						`,
						values: [
							newProduct.name,
							newProduct.description,
							+newProduct.category,
							+newProduct.price,
							+newProduct.quantity,
							new Date(),
							req.params.id,
						],
					};

					await db.query(SQL.text, SQL.values);
				};
				await Promise.all([
					file && handleUpdateImage(),
					!file &&
						oldProduct.name !== newProduct.name &&
						RenameProductImage(),
					editProduct(),
				]);
				res.redirect(`/inventory/products/${oldProduct.id}`);
			};

			const renderErrorMessages = () => {
				const errors = schemaErrors.mapped();
				file &&
					imageError &&
					(errors.image = {
						msg: "The image is required, size must be less than 500 kb, width and height must be 800 or greater.",
					});

				res.render("productForm", {
					title: "Update product",
					categories: categories.rows,
					product: {
						...req.body,
						id: req.params.id,
						category_id: Number(req.body.category),
						imageUrl: `https://storage.googleapis.com/${getImageUrl(
							{ product: product.rows[0] }
						)}`,
					},
					errors,
				});
			};

			schemaErrors.isEmpty() && (!file || !imageError)
				? updateProduct()
				: renderErrorMessages();
		};

		product.rows.length
			? product.rows[0].expired === Infinity
				? res.redirect(`/inventory/products/${product.rows[0].id}`)
				: validationFields()
			: next(createError(404, "Product not found", { type: "product" }));
	}),
];
const productDeleteGet = asyncHandler(async (req, res, next) => {
	const { rows } = await db.query("SELECT * FROM products WHERE id= $1", [
		req.params.id,
	]);
	const product = rows[0];

	rows.length
		? product.expired === Infinity
			? res.redirect(`/inventory/products/${product.id}`)
			: res.render("productDetail", {
					title: "Product delete",
					product,
			  })
		: next(createError(404, "Product not found", { type: "product" }));
});
const productDeletePost = asyncHandler(async (req, res, next) => {
	const { rows } = await db.query("SELECT * FROM products WHERE id= $1", [
		req.params.id,
	]);
	const product = rows[0];

	const handleDelete = async () => {
		const deleteProductImage = async () => {
			await googleStorage
				.bucket(bucketName)
				.file(encodeFile(product.name))
				.delete();
		};

		await db
			.query(`DELETE FROM products WHERE id= $1`, [req.params.id])
			.then(async () => await deleteProductImage());
		res.redirect("/inventory/products");
	};

	rows.length
		? product.expired === Infinity
			? res.redirect(`/inventory/products/${product.id}`)
			: handleDelete()
		: next(createError(404, "Product not found", { type: "product" }));
});
export {
	productList,
	productDetail,
	productCreateGet,
	productCreatePost,
	productUpdateGet,
	productUpdatePost,
	productDeleteGet,
	productDeletePost,
};
