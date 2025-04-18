# Use official Node.js LTS image
FROM node:20

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the app
COPY . .

# Tell Cloud Run which port we’ll use
ENV PORT=3001
EXPOSE 3001

# Start the app
CMD ["node", "server.js"]
