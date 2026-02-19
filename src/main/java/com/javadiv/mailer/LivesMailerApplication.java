package com.javadiv.mailer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class LivesMailerApplication {

    public static void main(String[] args) {
        SpringApplication.run(LivesMailerApplication.class, args);
    }
}
