FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    sudo \
    vim \
    # Bổ sung các công cụ mạng và quản lý tiến trình
    iproute2 \
    net-tools \
    procps \
    lsof \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Tạo user và cấp quyền sudo
RUN useradd -m agent && echo "agent ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Tạo thư mục và gán quyền
RUN mkdir -p /home/agent/app && chown -R agent:agent /home/agent/app

USER agent
WORKDIR /home/agent/app

CMD ["tail", "-f", "/dev/null"]