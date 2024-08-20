import db from "./database.js";
import debug from "debug";

const databaseLog = debug("PostgreSQL");

const isTableExist = async name => {
	const SQL = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name= $1) AS exist;`;
	const { rows } = await db.query(SQL, [name]);
	return rows[0].exist;
};
const initialCategories = async () => {
	const SQL = `CREATE TABLE categories (
	                	id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	                    name VARCHAR ( 30 ) NOT NULL,
	                    description TEXT NOT NULL,
	                    expired timestamptz DEFAULT 'infinity'
	                );`;

	const seeding = {
		text: `INSERT INTO categories (name, description)
					VALUES
						('Dry Dog Food', 'Discover our great selection of the best dry dog food at fantastic prices shipped across Ireland. Find dog food that matches the nutritional needs of your dog, based on age, breed, or special health and dietary needs.'),
						('Wet Dog Food', 'Wet dog food makes a great supplement to dry dog food. Canned dog foods and pouches can also be a tasty meal on their own. Here you''ll find a great selection of wet dog foods available in cans or pouches in a variety of sizes.'),
						('Dog Treats', 'Dog treats and dog snacks are sensible supplements to your pet''s regular diet. Treats for dogs can provide your pooch with extra vitamins and nutrients that regular dog food may not provide and many are good for dental health too plus stop your dog finding other things to chew.'),
						('Dog Toys', 'Dog toys can help you build a trusting relationship with your dog and provide all-important exercise and activity. Dog sports, including dog agility courses, are also gaining popularity and various dog training equipment can help you & your pet be successful in your goals and bring variety and enjoyment to your dog''s agility sessions. Chew toys can also be great in keeping your dog''s teeth and gums healthy. Jaw muscles can be strengthened through extensive chewing. It also helps to keep teeth clean, combatting plaque and tartar build up through dental abrasion.')
				;`,
	};

	await db.query(SQL).then(async () => await db.query(seeding.text));
};
const initialProducts = async () => {
	const SQL = `CREATE TABLE products (
	                	id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	                    name VARCHAR ( 100 ) NOT NULL,
	                    description TEXT NOT NULL,
						category_id INTEGER REFERENCES categories,
						price NUMERIC NOT NULL,
						quantity INTEGER NOT NULL, 
						modified timestamptz DEFAULT 'now',
	                    expired timestamptz DEFAULT 'infinity'
	                );`;

	const seeding = {
		text: `INSERT INTO products (name, description, category_id, price, quantity)
						VALUES
							('Wolf of Wilderness Adult "Sunny Glade" - Venison', 'This premium adult dry dog food is grain-free and based on the wolf''s natural diet. It is made with 41% fresh chicken & top quality venison, enriched with berries, wild herbs and roots.', 1, 7.49, 50),
							('Wolf of Wilderness Adult "Wild Hills" - Duck', 'Made with 41% fresh chicken and duck, and enriched with berries, wild herbs and roots, this premium quality, grain-free dry food is based on the wolf''s natural diet in the wild.', 1, 7.99, 50),
							('Wolf of Wilderness Adult "Blue River" - Salmon', 'Delicious kibble for adult dogs, made with 41% fresh chicken and salmon, enriched with berries, wild herbs and roots, this quality dry dog food is grain-free and reflects the wolf''s natural diet.', 1, 7.99, 50),
							('Wolf of Wilderness Adult "Oak Woods" - Wild Boar', 'Species appropriate, grain-free dry dog food that mimics the wolf''s natural wild diet, made with 41% fresh chicken and wild boar refined with berries, wild herbs and roots.', 1, 7.99, 50),
							('Wolf of Wilderness Adult "Green Fields" - Lamb', 'Grain-free, species-appropriate adult dry dog food based on the wild wolf''s natural diet, this wholesome kibble is made with lamb and 41% fresh chicken, enriched with berries, herbs & roots.', 1, 7.49, 50),
							('Lukullus Rabbit & Game x6', 'Lukullus natural dog food is a healthy complete diet and provides your pet with all essential nutrients, in the flavour Rabbit & Game with Brown Rice, Apple & Linseed Oil. Now in a fresh new design!', 2, 19.99, 30),
							('Lukullus Wild Rabbit & Turkey x6', 'Lukullus is a delicious food for dogs, full of essential nutrients and natural, healthy ingredients. In tasty variety Wild Rabbit & Turkey with Pear, Oat Flakes & Safflower Oil. Now in a new design!', 2, 20.99, 30),
							('Lukullus Turkey Hearts & Goose x6', 'Lukullus wet dog food is a natural, healthy diet & provides your pet with important nutrients. In the delicious flavour Turkey Hearts & Goose with Barley, Leek & Safflower Oil. Now in a new design!', 2, 20.99, 30),
							('Lukullus Poultry & Lamb - Grain-Free x6', 'A tasty, all-natural grain-free wet dog food, made with carefully selected ingredients. Poultry and lamb are combined with potatoes, dandelion and linseed oil to create a nutritious, complete meal.', 2, 17.99, 30),
							('Lukullus Beef & Turkey - Grain-Free x6', 'Grain-free. with wholesome beef & turkey, this complete wet dog food provides all the nutrients and vitamins your pet needs. Made with healthy ingredients, herbs and oils, it is totally additive-free.', 2, 17.99, 30),
							('Cookies Delikatess Chew Rolls with Chicken Fillet Strips', 'Crispy chew sticks for dogs, wrapped in delicious chicken filet strips for long-lasting chewing enjoyment and gently oven-dried, low in fat and easy to digest, with food-grade quality meat.', 3, 5.49, 40),
							('Rocco Chings Originals Chicken Breast', 'These delicious chewy snacks are made from 93% wholesome chicken and are bound to be a firm favourite with your dog - they are grain-free, low in fat and easy to digest.', 3, 4.79, 40),
							('Pedigree Dentastix - Daily Oral Care for Small Dogs', 'Dental care sticks by Pedigree, ideal for small dogs, with special texture, with active cleaning ingredients proven to reduce plaque and tartar, low in fat.', 3, 2.49, 40),
							('Dokas Chew Snack Chicken Breast with Fish', 'Tasty air-dried chew snack for dogs in a flavoursome chicken and fish combo. Very low in fat and easy to digest.', 3, 5.99, 40),
							('Squeaky Ball Dog Toy', 'Green, squeaky dog ball, made from durable thermoplastic rubber (TPR), with a nubby surface which massages your dog''s gums. Pleasant to hold, it floats and bounces. Great for water games!', 4, 1.49, 20),
							('KONG Scrunch Knots Fox', 'This crazy toy scrunches around an internal coiled rope and has stretchy sides for realistic movement. The toy is fluffy yet durable, and there is an integrated squeaker in the head of the fox.', 4, 7.29, 20),
							('Squirrel Dog Toy', 'This crazy toy scrunches around an internal coiled rope and has stretchy sides for realistic movement. The toy is fluffy yet durable, and there is an integrated squeaker in the head of the fox.', 4, 7.29, 20),
							('Giant Snake Dog Toy', 'Fun giant snake dog toy in green and black patterned plush with squeakers in the head and tail. Flexible and soft, it is designed to give your dog hours of amusement and play.', 4, 10.49, 20),
							('Little Paws Dog Frisbee', 'Flexible frisbee made from robust thermoplastic rubber (TPR). Cute design with bone and pawprint details. Perfect for games of fetch as it is easy to throw a long way and even floats. Easy to clean.', 4, 4.99, 20)
					;`,
	};
	await db.query(SQL).then(async () => await db.query(seeding.text));
};
const handleSeeding = async () => {
	databaseLog("Seeding tables...");

	!(await isTableExist("categories")) && (await initialCategories());
	!(await isTableExist("products")) && (await initialProducts());

	databaseLog("Seeding tables successfully.");
};

export default handleSeeding;

// 不需使用 TTL 只需根據是否超過 expired 而排除搜尋內容
