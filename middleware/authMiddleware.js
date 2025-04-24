const jwt = require("jsonwebtoken");

const JWT_SECRET = "mysecretkey"; // Define the JWT secret directly

module.exports = (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Access denied, no token provided" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Use the directly defined secret key
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid token" });
    }
};
module.exports.JWT_SECRET = JWT_SECRET;