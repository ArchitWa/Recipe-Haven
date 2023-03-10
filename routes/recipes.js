const express = require("express")

const Cuisine = require("../models/cuisine")
const Recipe = require("../models/recipe")
const router = express.Router()

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif']



// All Recipes Route
router.get('/', async (req, res) => {
    let query = Recipe.find()
    if (req.query.title !== null && req.query.title !== "") {
        query = query.regex('title', new RegExp(req.query.title, 'i'))
    }

    if (req.query.rawIng) {
        const ingredients = req.query.rawIng.endsWith(",")
            ? req.query.rawIng.substring(0, req.query.rawIng.length - 1).toLowerCase().split(",")
            : req.query.rawIng.toLowerCase().split(",")

        query = query.find({ ingredients: { $all: ingredients } })
    }

    let t = [0, 0, 0]
    if (req.query.days) t[0] = Number(req.query.days)
    if (req.query.hours) t[1] = Number(req.query.hours)
    if (req.query.minutes) t[2] = Number(req.query.minutes)
    if (t[0] === 0 && t[1] === 0 && t[2] === 0) t = [30, 24, 60]

    // need to fix searching mech
    let mins = t[0] * 60 * 24 + t[1] * 60 + t[2]
    query = query.find({ "mins": { $lte: mins }})

    try {
        const recipes = await query.exec()
        res.render('recipes/index', {
            recipes: recipes,
            searchOptions: req.query
        })
    } catch (error) {
        console.log(error)
        res.redirect('/')
    }

})

// New Recipe Route
router.get('/new', async (req, res) => {
    try {
        let params = req.flash("params")[0]
        if (!params) {
            const cuisines = await Cuisine.find({})
            params = {
                cuisines: cuisines,
                recipe: new Recipe()
            }
        }
        res.render(`recipes/new`, params)
    } catch {
        res.redirect('/recipes')
    }


})

// Create Recipe Route
router.post('/', async (req, res) => {
    let ingredients = req.body.rawIng.endsWith(",")
        ? req.body.rawIng.substring(0, req.body.rawIng.length - 1).toLowerCase().split(",")
        : req.body.rawIng.toLowerCase().split(",")
    if (ingredients.length === 1 && ingredients[0] == '') ingredients = null

    let prepTime = [0, 0, 0]
    if (req.body.days) prepTime[0] = Number(req.body.days)
    if (req.body.hours) prepTime[1] = Number(req.body.hours)
    if (req.body.minutes) prepTime[2] = Number(req.body.minutes)

    const recipe = new Recipe({
        title: req.body.title,
        cuisine: req.body.cuisine,
        description: req.body.description.trim(),
        instructions: req.body.instructions,
        ingredients: ingredients,
        prepTime: prepTime,
        mins: prepTime[0] * 24 * 60 + prepTime[1] * 60 + prepTime[2]
    })

    saveImage(recipe, req.body.image)

    try {
        const newRecipe = await recipe.save()
        res.redirect(`recipes/${newRecipe.id}`)
    } catch (err) {
        console.log(err)
        try {
            const cuisines = await Cuisine.find({})
            const params = {
                cuisines: cuisines,
                recipe: recipe,
                errorMessage: `Error Creating Recipe`
            }

            req.flash('params', params)
            res.redirect(`recipes/new`)
        } catch (err) {
            console.log(err);
            res.redirect('/recipes')
        }
    }
})

// Show Recipe Route
router.get('/:id', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id).populate('cuisine').exec()
        res.render("recipes/show", { recipe: recipe })
    } catch {
        res.redirect("/")
    }
})

// Edit Recipe Route
router.get('/:id/edit', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id)
        renderEditPage(res, recipe)
    } catch {
        res.redirect('/')
    }
})

// Update Recipe Route
router.put('/:id', async (req, res) => {
    let recipe;
    try {
        recipe = await Recipe.findById(req.params.id)

        let ingredients = req.body.rawIng.endsWith(",")
            ? req.body.rawIng.substring(0, req.body.rawIng.length - 1).toLowerCase().split(",")
            : req.body.rawIng.toLowerCase().split(",")
        if (ingredients.length === 1 && ingredients[0] == '') ingredients = null

        recipe.title = req.body.title
        recipe.cuisine = req.body.cuisine
        recipe.description = req.body.description.trim()
        recipe.instructions = req.body.instructions.trim()
        recipe.ingredients = ingredients
        recipe.prepTime = [Number(req.body.days), Number(req.body.hours), Number(req.body.minutes)]

        if (req.body.image) {
            saveImage(recipe, req.body.image)
        }
        await recipe.save()
        res.redirect(`/recipes/${recipe.id}`)

    } catch (err) {
        if (recipe != null) {
            renderEditPage(res, recipe, true)
        } else {
            console.log(err);
            res.redirect('/')
        }
    }
})

// Delete Recipe Route
router.delete('/:id', async (req, res) => {
    let recipe
    try {
        recipe = await Recipe.findById(req.params.id)
        await recipe.remove()
        res.redirect(`/recipes`)
    } catch {
        if (recipe != null) {
            res.render('recipes/show', {
                recipe: recipe,
                errorMessage: 'Could not remove book'
            })
        } else {
            res.redirect('/')
        }
    }
})


async function renderNewPage(res, recipe, hasError = false) {
    renderFormPage(res, recipe, 'new', hasError)
}

async function renderEditPage(res, recipe, hasError = false) {
    renderFormPage(res, recipe, 'edit', hasError)
}

async function renderFormPage(res, recipe, form, hasError = false) {
    try {
        const cuisines = await Cuisine.find({})
        const params = {
            cuisines: cuisines,
            recipe: recipe
        }
        if (hasError) params.errorMessage = `Error ${form === 'edit' ? "Updating" : "Creating"} Recipe`
        res.render(`recipes/${form}`, params)
    } catch {
        res.redirect('/recipes')
    }
}

function saveImage(recipe, imageEncoded) {

    if (!imageEncoded) return

    const image = JSON.parse(imageEncoded)
    if (image != null && imageMimeTypes.includes(image.type)) {
        recipe.foodImage = new Buffer.from(image.data, 'base64')
        recipe.foodImageType = image.type
    }
}


module.exports = router