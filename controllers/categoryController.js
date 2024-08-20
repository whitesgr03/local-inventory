import createError from "http-errors";
import asyncHandler from "express-async-handler";
import { validationResult, checkSchema, matchedData } from "express-validator";

import db from "../config/database.js";

const index = asyncHandler(async (req, res) => {
	const { rows: categories } = await db.query(
		`SELECT COUNT(*) FROM categories;`
	);
	const { rows: products } = await db.query(`SELECT COUNT(*) FROM products;`);

	res.render("index", {
		categories_count: categories[0].count,
		products_count: products[0].count,
	});
});
const categoryList = asyncHandler(async (req, res) => {
	const SQL = {
		text: `SELECT id, name FROM categories 
		WHERE expired = 'Infinity' OR  $1 < expired
		ORDER BY name;`,
		values: [new Date()],
	};
	const { rows: categories } = await db.query(SQL.text, SQL.values);

	res.render("categoryList", {
		title: "Category List",
		categories,
	});
});
const categoryDetail = asyncHandler(async (req, res, next) => {
	const [category, products] = await Promise.all([
		db.query(`SELECT * FROM categories WHERE id = $1`, [req.params.id]),
		db.query(
			`SELECT id, name FROM products WHERE category_id = $1 ORDER BY name`,
			[req.params.id]
		),
	]);

	category.rows.length
		? res.render("categoryDetail", {
				category: category.rows[0],
				products: products.rows,
		  })
		: next(createError(404, "Category not found", { type: "category" }));
});
const categoryCreateGet = asyncHandler((req, res) =>
	res.render("categoryForm", {
		title: "Add a new category",
const categoryCreatePost = asyncHandler(async (req, res) => {
	const validationSchema = {
		name: {
			trim: true,
			isLength: {
				options: { max: 30 },
				errorMessage: "The name must be less than 30 long.",
				bail: true,
			},
			custom: {
				options: value =>
					new Promise(async (resolve, reject) => {
						const { rows: category } = await db.query(
							`SELECT EXISTS (SELECT name FROM categories WHERE name = $1) AS exist;`,
							[value]
						);
						category[0].exist ? reject() : resolve();
					}),
				errorMessage: "The name is been used.",
			},
		},
		description: {
			trim: true,
			notEmpty: { errorMessage: "The description is required." },
		},
	};

	await checkSchema(validationSchema, ["body"]).run(req);

	const schemaErrors = validationResult(req);

	const category = {
		...req.body,
	};

	const addNewCategory = async () => {
		const oneDay = 24 * 60 * 60 * 1000;
		const SQL = {
			text: `
				INSERT INTO categories (name, description, expired)
				VALUES ($1, $2, $3)
				RETURNING id;
			`,
			values: [
				category.name,
				category.description,
				new Date(Date.now() + oneDay),
			],
		};

		const { rows: newCategory } = await db.query(SQL.text, SQL.values);

		res.redirect(`/inventory/categories/${newCategory[0].id}`);
	};

	const renderErrorMessages = () => {
		res.render("categoryForm", {
			title: "Add a new category",
			category,
			errors: schemaErrors.mapped(),
		});
	};

	schemaErrors.isEmpty() ? addNewCategory() : renderErrorMessages();
});
const categoryUpdateGet = asyncHandler(async (req, res, next) => {
	const SQL = {
		text: `
			SELECT * FROM categories 
			WHERE id = $1 AND $2 < expired
		`,
		values: [req.params.id, new Date()],
	};

	const { rows } = await db.query(SQL.text, SQL.values);
	const category = rows[0];

	rows.length
		? category.expired === Infinity
			? res.redirect(`/inventory/categories/${category.id}`)
			: res.render("categoryForm", {
					title: "Update category",
					category,
			  })
		: next(createError(404, "Category not found", { type: "category" }));
});
const categoryUpdatePost = asyncHandler(async (req, res, next) => {
	const SQL = {
		text: `
			SELECT * FROM categories 
			WHERE id = $1 AND $2 < expired
		`,
		values: [req.params.id, new Date()],
	};
	const { rows } = await db.query(SQL.text, SQL.values);
	const category = rows[0];

	const validationFields = async () => {
		const validationSchema = {
			name: {
				trim: true,
				isLength: {
					options: { max: 30 },
					errorMessage: "The name must be less than 30 long.",
					bail: true,
				},
				custom: {
					options: (value, { req }) =>
						new Promise(async (resolve, reject) => {
							const { rows: category } = await db.query(
								`SELECT EXISTS 
								(SELECT name FROM categories WHERE name= $1 AND id != $2)
								AS exist;`,
								[value, Number(req.params.id)]
							);
							category[0].exist ? reject() : resolve();
						}),
					errorMessage: "The name is been used.",
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

		const updateCategory = async () => {
			const newCategory = matchedData(req);
			const SQL = {
				text: `
					UPDATE categories SET name= $1, description= $2
					WHERE id= $3;
				`,
				values: [
					newCategory.name,
					newCategory.description,
					req.params.id,
				],
			};
			await db.query(SQL.text, SQL.values);
			res.redirect(`/inventory/categories/${category.id}`);
		};
		const renderErrorMessages = () => {
			res.render("categoryForm", {
				title: "Update category",
				category: {
					...req.body,
					id: req.params.id,
				},
				errors: schemaErrors.mapped(),
			});
		};
		schemaErrors.isEmpty() ? updateCategory() : renderErrorMessages();
	};

	rows.length
		? category.expired === Infinity
			? res.redirect(`/inventory/categories/${category.id}`)
			: validationFields()
		: next(createError(404, "Category not found", { type: "category" }));
});
const categoryDeleteGet = asyncHandler(async (req, res, next) => {
	const [category, products] = await Promise.all([
		db.query(`SELECT * FROM categories WHERE id = $1 AND $2 < expired`, [
			req.params.id,
			new Date(),
		]),
		db.query(`SELECT id, name FROM products WHERE category_id = $1`, [
			req.params.id,
		]),
	]);

	const renderTemplate = () => {
		products.rows.length
			? (res.locals.alert = true)
			: (res.locals.title = "Category delete");

		res.render("categoryDetail", {
			category: category.rows[0],
			products: products.rows,
		});
	};

	category.rows.length
		? category.rows[0].expired === Infinity
			? res.redirect(`/inventory/categories/${category.rows[0].id}`)
			: renderTemplate()
		: next(
				createError(404, "Category not found", {
					type: "category",
				})
		  );
});
const categoryDeletePost = asyncHandler(async (req, res, next) => {
	const [category, products] = await Promise.all([
		db.query(`SELECT * FROM categories WHERE id = $1 AND $2 < expired`, [
			req.params.id,
			new Date(),
		]),
		db.query(`SELECT id, name FROM products WHERE category_id = $1`, [
			req.params.id,
		]),
	]);

	const deleteCategory = async () => {
		const SQL = {
			text: `
				DELETE FROM categories WHERE id= $1
			`,
			values: [req.params.id],
		};
		await db.query(SQL.text, SQL.values);
		res.redirect("/inventory/categories");
	};

	category.rows.length
		? category.rows[0].expired === Infinity
			? res.redirect(`/inventory/categories/${category.rows[0].id}`)
			: !products.rows.length && deleteCategory()
		: next(
				createError(404, "Category not found", {
					type: "category",
				})
		  );
});
export {
	index,
	categoryList,
	categoryDetail,
	categoryCreateGet,
	categoryCreatePost,
	categoryUpdateGet,
	categoryUpdatePost,
	categoryDeleteGet,
	categoryDeletePost,
};
