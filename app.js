import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import createError from "http-errors";
import morgan from "morgan";
import debug from "debug";
import compression from "compression";
import helmet from "helmet";

// routes
import indexRouter from "./routes/index.js";
import inventoryRouter from "./routes/inventory.js";

const app = express();
const errorLog = debug("ServerError");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const helmetOptions = {
	contentSecurityPolicy: {
		directives: {
			imgSrc: [
				"storage.googleapis.com",
				"ik.imagekit.io",
				"data:",
				"blob:",
			],
			styleSrc: ["'self'", "fonts.googleapis.com", "necolas.github.io"],
		},
	},
};
const staticOptions = {
	index: false,
	redirect: false,
};

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(helmet(helmetOptions));
app.use(express.static(path.join(__dirname, "public"), staticOptions));
app.use(express.urlencoded({ extended: false }));
app.use(morgan(process.env.production ? "common" : "dev"));
app.use(compression());

app.get("/favicon.ico", (req, res) => res.status(204));
app.use("/", indexRouter);
app.use("/inventory", inventoryRouter);

// unknown routes handler
app.use((req, res, next) => {
	next(createError(404, "Page not found", { type: "page" }));
});

// error handler
app.use((err, req, res, next) => {
	res.status(err.status || 500);

	const renderNotFound = () => {
		err.cause && errorLog(`${err.cause.name}: ${err.cause.message}`);
		res.render("notFound", {
			type: err.type,
		});
	};

	const renderError = () => {
		errorLog(`${err.name}: ${err.message}`);
		errorLog(err);
		res.render("error");
	};

	err?.type ? renderNotFound() : renderError();
});

export default app;
