import { app } from "./src/app.js";

const PORT = process.env.PORT || 3000

try {
    app.listen(PORT, () => {
        console.log("server is running on PORT:", PORT)
    })
} catch (err) {
    console.error("Error occured while starting the server", err)
    process.exit(1)
}