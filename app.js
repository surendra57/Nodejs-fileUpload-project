const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const uuid = require("uuid");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const { authenticateToken } = require("./auth");

const app = express();
dotenv.config();

const PORT = process.env.PORT || 5500;
const URL = process.env.MONGO_URL;

// Database connection
mongoose
  .connect(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((data) => {
    console.log(`Database is Connected On ${data.connection.host}`);
  });

//Schema
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
    },
    password: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const fileSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  originalname: String,
  filename: String,
  code: String,
});

const User = mongoose.model("User", userSchema);
const File = mongoose.model("File", fileSchema);

// middleware
app.use(express.json());
app.use(cookieParser());

//Register User
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({
      username,
      password: hashedPassword,
    });

    if (!user) {
      return res.status(500).json({
        message: "User creation failed",
      });
    }

    res.status(201).json({
      messsage: "User Registered Successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error occured",
    });
  }
});

// Login

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ error: "User is not found" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Password is Wrong" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });

    res.status(200).cookie("token", token).json({
      messsage: "User Login Successfully",
      token,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Authentication failed",
    });
  }
});

// Uploading Filee
const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) => {
    const filename = uuid.v4() + "-" + file.originalname;
    cb(null, filename);
  },
});

const upload = multer({ storage });

app.post(
  "/uploads",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const { userId } = req.user;

      const { originalname, filename } = req.file;
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const file = await File.create({
        userId,
        originalname,
        filename,
        code,
      });

      res.status(201).json({
        message: "File uploaded",
        code,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "File upload failed" });
    }
  }
);

// Get files for a user
app.get("/files", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const files = await File.find({ userId });
    res.status(200).json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "File retrieval failed" });
  }
});

// Delete file
app.delete("/files/:id", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;

    const file = await File.findOne({ _id: id, userId });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = `uploads/${file.filename}`;
    fs.unlink(filePath, (err) => {
      console.log(err);
    });

    await file.deleteOne();

    res.status(200).json({
      message: "File deleted",
    });
  } catch (error) {
    res.status(500).json({
      error: "File deletion failed",
    });
  }
});

// through 6 digit code file Download

app.get("/download/:code", authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    const file = await File.findOne({ code });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = `uploads/${file.filename}`;
    res.download(filePath, file.originalname);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "File Retrival failed",
    });
  }
});

// logout
app.get("/logout", async (req, res) => {
  res.cookie("token", null);

  res.status(200).json({
    message: "Log out Successfully",
  });
});

app.get("/", (req, res) => {
  res.send("hello");
});

app.listen(PORT, () => {
  console.log(`Server is Running on ${PORT}`);
});
