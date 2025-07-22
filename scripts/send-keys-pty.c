#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <string.h>
#include <termios.h>
#include <errno.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s /dev/pts/X \"text to send\"\n", argv[0]);
        return 1;
    }
    
    int fd = open(argv[1], O_RDWR);
    if (fd < 0) {
        perror("Failed to open terminal");
        return 1;
    }
    
    // Get current terminal settings
    struct termios tios;
    if (tcgetattr(fd, &tios) < 0) {
        perror("tcgetattr failed");
    }
    
    char *text = argv[2];
    
    // Send the text
    for (int i = 0; i < strlen(text); i++) {
        if (ioctl(fd, TIOCSTI, &text[i]) < 0) {
            perror("Failed to send character");
            close(fd);
            return 1;
        }
        usleep(1000); // 1ms delay between chars
    }
    
    // Now send Enter - try multiple approaches
    
    // Method 1: Send CR only
    char cr = '\r';
    if (ioctl(fd, TIOCSTI, &cr) < 0) {
        fprintf(stderr, "Failed to send CR: %s\n", strerror(errno));
    }
    
    // Give it a moment
    usleep(10000);
    
    // Method 2: If terminal is in canonical mode, it might need LF
    if (tios.c_lflag & ICANON) {
        char lf = '\n';
        if (ioctl(fd, TIOCSTI, &lf) < 0) {
            fprintf(stderr, "Failed to send LF: %s\n", strerror(errno));
        }
    }
    
    close(fd);
    return 0;
}