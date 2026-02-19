FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY . .
RUN ./mvnw install -DskipTests
CMD ["./mvnw", "spring-boot:run"]
